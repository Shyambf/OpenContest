package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type SubmissionJob struct {
	SubmissionID  int    `json:"submission_id"`
	ContestID     string `json:"contest_id"`
	ProblemID     int    `json:"problem_id"`
	Language      string `json:"language"`
	SourceCode    string `json:"source_code"`
	TimeLimitMS   int    `json:"time_limit_ms"`
	MemoryLimitMB int    `json:"memory_limit_mb"`
	CheckerType   string `json:"checker_type"`
	CheckerCode   string `json:"checker_code"`
	CheckerLang   string `json:"checker_language"`
	Tests         []Test `json:"tests"`
}

type Test struct {
	ID       int    `json:"id"`
	Input    string `json:"input"`
	Output   string `json:"output"`
	IsSample bool   `json:"is_sample"`
}

type Verdict struct {
	Status      string
	TimeMS      int
	MemoryKB    int
	JudgeOutput string
}

type PreparedProgram struct {
	Command []string
}

type RunnerState struct {
	mu                  sync.Mutex
	RunnerID            string
	Hostname            string
	Status              string
	CurrentSubmissionID *int
	JobsProcessed       int
	LastVerdict         string
	StartedAt           time.Time
}

func main() {
	rabbitURL := getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
	queueName := getenv("JUDGE_QUEUE", "judge.submissions")
	hostname, _ := os.Hostname()
	state := &RunnerState{
		RunnerID:  getenv("RUNNER_ID", hostname),
		Hostname:  hostname,
		Status:    "idle",
		StartedAt: time.Now().UTC(),
	}
	go heartbeatLoop(state)

	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		log.Fatalf("connect rabbitmq: %v", err)
	}
	defer conn.Close()

	channel, err := conn.Channel()
	if err != nil {
		log.Fatalf("open channel: %v", err)
	}
	defer channel.Close()

	queue, err := channel.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		log.Fatalf("declare queue: %v", err)
	}

	if err := channel.Qos(1, 0, false); err != nil {
		log.Fatalf("set qos: %v", err)
	}

	deliveries, err := channel.Consume(queue.Name, "", false, false, false, false, nil)
	if err != nil {
		log.Fatalf("consume: %v", err)
	}

	log.Printf("runner is waiting for jobs from %s", queue.Name)
	for delivery := range deliveries {
		var job SubmissionJob
		if err := json.Unmarshal(delivery.Body, &job); err != nil {
			log.Printf("bad job payload: %v", err)
			_ = delivery.Nack(false, false)
			continue
		}

		state.markBusy(job.SubmissionID)
		if err := runJob(job, state); err != nil {
			log.Printf("submission %d failed: %v", job.SubmissionID, err)
			state.markIdle("runner_error")
			_ = delivery.Nack(false, true)
			continue
		}
		_ = delivery.Ack(false)
	}
}

func runJob(job SubmissionJob, state *RunnerState) error {
	log.Printf("received submission=%d language=%s problem=%d", job.SubmissionID, job.Language, job.ProblemID)

	_ = reportResult(job.SubmissionID, map[string]any{
		"status":       "Running",
		"judge_output": "Runner started judging.",
	})

	verdict := judge(job)
	state.markIdle(verdict.Status)
	return reportResult(job.SubmissionID, map[string]any{
		"status":       verdict.Status,
		"time_ms":      verdict.TimeMS,
		"memory_kb":    verdict.MemoryKB,
		"judge_output": verdict.JudgeOutput,
	})
}

func (state *RunnerState) markBusy(submissionID int) {
	state.mu.Lock()
	defer state.mu.Unlock()
	state.Status = "busy"
	state.CurrentSubmissionID = &submissionID
}

func (state *RunnerState) markIdle(verdict string) {
	state.mu.Lock()
	defer state.mu.Unlock()
	state.Status = "idle"
	state.CurrentSubmissionID = nil
	state.JobsProcessed++
	state.LastVerdict = verdict
}

func judge(job SubmissionJob) Verdict {
	if len(job.Tests) == 0 {
		return Verdict{Status: "RE", JudgeOutput: "No tests were provided in the job payload."}
	}

	workdir, err := os.MkdirTemp("", fmt.Sprintf("opencontest-%d-", job.SubmissionID))
	if err != nil {
		return Verdict{Status: "RE", JudgeOutput: err.Error()}
	}
	defer os.RemoveAll(workdir)

	program, output, err := prepareProgram(job, workdir)
	if err != nil {
		return Verdict{Status: "CE", JudgeOutput: output}
	}

	var logs []string
	maxTime := 0
	for index, test := range job.Tests {
		result, elapsedMS, err := runTest(job, program, test)
		if elapsedMS > maxTime {
			maxTime = elapsedMS
		}
		label := fmt.Sprintf("Test %d", index+1)
		if test.IsSample {
			label += " (sample)"
		}
		if errors.Is(err, context.DeadlineExceeded) {
			logs = append(logs, fmt.Sprintf("%s: TLE", label))
			return Verdict{Status: "TLE", TimeMS: maxTime, JudgeOutput: strings.Join(logs, "\n")}
		}
		if err != nil {
			if isLikelyTimeLimit(job, elapsedMS, err) {
				logs = append(logs, fmt.Sprintf("%s: TLE\n%s", label, result))
				return Verdict{Status: "TLE", TimeMS: maxTime, JudgeOutput: strings.Join(logs, "\n")}
			}
			logs = append(logs, fmt.Sprintf("%s: RE: %v\n%s", label, err, result))
			return Verdict{Status: "RE", TimeMS: maxTime, JudgeOutput: strings.Join(logs, "\n")}
		}
		ok, checkerLog, checkerErr := checkOutput(job, workdir, test.Input, result, test.Output)
		if checkerErr != nil {
			logs = append(logs, fmt.Sprintf("%s: RE in checker: %v\n%s", label, checkerErr, checkerLog))
			return Verdict{Status: "RE", TimeMS: maxTime, JudgeOutput: strings.Join(logs, "\n")}
		}
		if !ok {
			logs = append(logs, fmt.Sprintf("%s: WA\nExpected:\n%s\nGot:\n%s", label, test.Output, result))
			if checkerLog != "" {
				logs = append(logs, "Checker:\n"+checkerLog)
			}
			return Verdict{Status: "WA", TimeMS: maxTime, JudgeOutput: strings.Join(logs, "\n")}
		}
		logs = append(logs, fmt.Sprintf("%s: OK (%dms)", label, elapsedMS))
	}

	return Verdict{Status: "AC", TimeMS: maxTime, JudgeOutput: strings.Join(logs, "\n")}
}

func isLikelyTimeLimit(job SubmissionJob, elapsedMS int, err error) bool {
	if elapsedMS < max(1, job.TimeLimitMS-250) {
		return false
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		code := exitErr.ExitCode()
		return code == 124 || code == 125 || code == 137 || code == 143
	}
	return false
}

func prepareProgram(job SubmissionJob, workdir string) (PreparedProgram, string, error) {
	switch job.Language {
	case "cpp":
		sourcePath := filepath.Join(workdir, "main.cpp")
		binaryPath := filepath.Join(workdir, "main")
		if err := os.WriteFile(sourcePath, []byte(job.SourceCode), 0600); err != nil {
			return PreparedProgram{}, err.Error(), err
		}
		if output, err := compileCPP(sourcePath, binaryPath); err != nil {
			return PreparedProgram{}, output, err
		}
		return PreparedProgram{Command: []string{binaryPath}}, "", nil
	case "python":
		sourcePath := filepath.Join(workdir, "main.py")
		if err := os.WriteFile(sourcePath, []byte(job.SourceCode), 0600); err != nil {
			return PreparedProgram{}, err.Error(), err
		}
		return PreparedProgram{Command: []string{"/usr/bin/python3", sourcePath}}, "", nil
	case "java":
		sourcePath := filepath.Join(workdir, "Main.java")
		if err := os.WriteFile(sourcePath, []byte(job.SourceCode), 0600); err != nil {
			return PreparedProgram{}, err.Error(), err
		}
		if output, err := compileJava(sourcePath); err != nil {
			return PreparedProgram{}, output, err
		}
		return PreparedProgram{Command: []string{"/usr/bin/java", "-cp", workdir, "Main"}}, "", nil
	case "rust":
		sourcePath := filepath.Join(workdir, "main.rs")
		binaryPath := filepath.Join(workdir, "main")
		if err := os.WriteFile(sourcePath, []byte(job.SourceCode), 0600); err != nil {
			return PreparedProgram{}, err.Error(), err
		}
		if output, err := compileRust(sourcePath, binaryPath); err != nil {
			return PreparedProgram{}, output, err
		}
		return PreparedProgram{Command: []string{binaryPath}}, "", nil
	default:
		err := fmt.Errorf("unsupported language: %s", job.Language)
		return PreparedProgram{}, err.Error(), err
	}
}

func compileCPP(sourcePath string, binaryPath string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "g++", "-std=c++17", "-O2", "-pipe", "-static", "-s", sourcePath, "-o", binaryPath)
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err := cmd.Run()
	return output.String(), err
}

func compileJava(sourcePath string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "javac", sourcePath)
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err := cmd.Run()
	return output.String(), err
}

func compileRust(sourcePath string, binaryPath string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "rustc", "-O", sourcePath, "-o", binaryPath)
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	err := cmd.Run()
	return output.String(), err
}

func runTest(job SubmissionJob, program PreparedProgram, test Test) (string, int, error) {
	timeout := time.Duration(job.TimeLimitMS+500) * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	seconds := max(1, (job.TimeLimitMS+999)/1000)
	nsjail := getenv("NSJAIL_BIN", "nsjail")
	args := []string{
		"--quiet",
		"--mode", "o",
		"--time_limit", fmt.Sprintf("%d", seconds),
		"--rlimit_as", fmt.Sprintf("%d", job.MemoryLimitMB),
		"--disable_proc",
	}
	if extra := strings.TrimSpace(getenv("NSJAIL_EXTRA_ARGS", "")); extra != "" {
		args = append(args, strings.Fields(extra)...)
	}
	args = append(args, "--")
	args = append(args, program.Command...)
	cmd := exec.CommandContext(ctx, nsjail, args...)
	cmd.Stdin = strings.NewReader(test.Input)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	err := cmd.Run()
	elapsedMS := int(time.Since(start).Milliseconds())
	if ctx.Err() != nil {
		return stdout.String() + stderr.String(), elapsedMS, ctx.Err()
	}
	if err != nil {
		return stdout.String() + stderr.String(), elapsedMS, err
	}
	return stdout.String(), elapsedMS, nil
}

func checkOutput(job SubmissionJob, workdir string, input string, output string, answer string) (bool, string, error) {
	if job.CheckerType == "" || job.CheckerType == "standard" || strings.TrimSpace(job.CheckerCode) == "" {
		return normalizeOutput(output) == normalizeOutput(answer), "", nil
	}
	if job.CheckerType != "custom" || job.CheckerLang != "python" {
		return false, fmt.Sprintf("unsupported checker: %s/%s", job.CheckerType, job.CheckerLang), nil
	}
	checkerPath := filepath.Join(workdir, "checker.py")
	wrapper := fmt.Sprintf(`import json
%s
payload = json.loads(input())
ok = check(payload["input"], payload["output"], payload["answer"])
print("OK" if ok else "WA")
`, job.CheckerCode)
	if err := os.WriteFile(checkerPath, []byte(wrapper), 0600); err != nil {
		return false, err.Error(), err
	}
	payload, _ := json.Marshal(map[string]string{
		"input":  input,
		"output": output,
		"answer": answer,
	})
	checkJob := job
	checkJob.TimeLimitMS = max(1000, job.TimeLimitMS)
	result, _, err := runTest(checkJob, PreparedProgram{Command: []string{"/usr/bin/python3", checkerPath}}, Test{Input: string(payload), Output: "OK"})
	if err != nil {
		return false, result, err
	}
	return normalizeOutput(result) == "OK", result, nil
}

func normalizeOutput(value string) string {
	lines := strings.Split(strings.TrimSpace(value), "\n")
	for index, line := range lines {
		lines[index] = strings.Join(strings.Fields(line), " ")
	}
	return strings.Join(lines, "\n")
}

func reportResult(submissionID int, payload map[string]any) error {
	return postBackend(fmt.Sprintf("/submissions/%d/result/", submissionID), payload)
}

func heartbeatLoop(state *RunnerState) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		if err := sendHeartbeat(state); err != nil {
			log.Printf("heartbeat failed: %v", err)
		}
		<-ticker.C
	}
}

func sendHeartbeat(state *RunnerState) error {
	state.mu.Lock()
	currentSubmissionID := state.CurrentSubmissionID
	payload := map[string]any{
		"runner_id":             state.RunnerID,
		"hostname":              state.Hostname,
		"status":                state.Status,
		"current_submission_id": currentSubmissionID,
		"jobs_processed":        state.JobsProcessed,
		"last_verdict":          state.LastVerdict,
		"supported_languages":   []string{"cpp", "python", "java", "rust"},
		"started_at":            state.StartedAt.Format(time.RFC3339),
		"load": map[string]any{
			"goroutines": runtime.NumGoroutine(),
			"cpus":       runtime.NumCPU(),
			"uptime_sec": int(time.Since(state.StartedAt).Seconds()),
		},
	}
	state.mu.Unlock()
	return postBackend("/runners/heartbeat/", payload)
}

func postBackend(path string, payload map[string]any) error {
	backendURL := strings.TrimRight(getenv("BACKEND_API_URL", "http://localhost:8000/api"), "/")
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	url := backendURL + path
	request, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Runner-Token", getenv("RUNNER_CALLBACK_TOKEN", ""))
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return fmt.Errorf("backend returned %s", response.Status)
	}
	return nil
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

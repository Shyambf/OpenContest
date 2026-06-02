package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Verdict struct {
	Status      string
	TimeMS      int
	MemoryKB    int
	JudgeOutput string
}

type PreparedProgram struct {
	Command []string
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

func prepareProgram(job SubmissionJob, workdir string) (PreparedProgram, string, error) {
	lang, ok := Languages[job.Language]
	if !ok {
		err := fmt.Errorf("unsupported language: %s", job.Language)
		return PreparedProgram{}, err.Error(), err
	}

	sourcePath := filepath.Join(workdir, lang.SourceFile)
	if err := os.WriteFile(sourcePath, []byte(job.SourceCode), 0600); err != nil {
		return PreparedProgram{}, err.Error(), err
	}

	for _, cmdArgs := range lang.CompileCommands {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, cmdArgs[0], cmdArgs[1:]...)
		cmd.Dir = workdir
		var output bytes.Buffer
		cmd.Stdout = &output
		cmd.Stderr = &output
		if err := cmd.Run(); err != nil {
			return PreparedProgram{}, output.String(), err
		}
	}

	runCmd := make([]string, len(lang.RunCommand))
	for i, part := range lang.RunCommand {
		if strings.HasPrefix(part, "./") || part == "main" || part == "Main" {
			// Если это ./main или что-то подобное, делаем абсолютный путь к ворквиру
			runCmd[i] = filepath.Join(workdir, strings.TrimPrefix(part, "./"))
		} else {
			runCmd[i] = part
		}
	}

	return PreparedProgram{Command: runCmd}, "", nil
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
		"--rlimit_fsize", "64",     // Лимит на размер файлов (64МБ)
		"--rlimit_nproc", "64",     // Защита от fork-бомбы
		"--disable_proc",           // Отключаем лишний доступ к /proc
		"--proc_rw", "false",       // /proc только на чтение
		"--clone_newnet", "true",   // Изолируем сеть (внутри не будет интернета)
		"--clone_newuser", "true",  // Новый user namespace
		"--clone_newns", "true",    // Новый mount namespace
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

func reportResult(ch *amqp.Channel, submissionID int, payload map[string]any) error {
	queueName := getenv("JUDGE_RESULTS_QUEUE", "judge.results")
	_, err := ch.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		return err
	}

	body, _ := json.Marshal(map[string]any{
		"submission_id": submissionID,
		"payload":       payload,
	})

	return ch.PublishWithContext(context.Background(), "", queueName, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}

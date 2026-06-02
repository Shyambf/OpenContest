package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
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

func main() {
	loadLanguages()

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
		if err := runJob(channel, job, state); err != nil {
			log.Printf("submission %d failed: %v", job.SubmissionID, err)
			state.markIdle("runner_error")
			_ = delivery.Nack(false, true)
			continue
		}
		_ = delivery.Ack(false)
	}
}

func runJob(ch *amqp.Channel, job SubmissionJob, state *RunnerState) error {
	log.Printf("received submission=%d language=%s problem=%d", job.SubmissionID, job.Language, job.ProblemID)

	_ = reportResult(ch, job.SubmissionID, map[string]any{
		"status":       "Running",
		"judge_output": "Runner started judging.",
	})

	verdict := judge(job)
	state.markIdle(verdict.Status)
	return reportResult(ch, job.SubmissionID, map[string]any{
		"status":       verdict.Status,
		"time_ms":      verdict.TimeMS,
		"memory_kb":    verdict.MemoryKB,
		"judge_output": verdict.JudgeOutput,
	})
}

func heartbeatLoop(state *RunnerState) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		if err := sendHeartbeat(state); err != nil {
			log.Printf("heartbeat failed: %v", err)
		}
		<-ticker.C
	}
}

func sendHeartbeat(state *RunnerState) error {
	payload := state.getHeartbeatPayload()
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

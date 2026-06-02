package main

import (
	"runtime"
	"sync"
	"time"
)

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

func (state *RunnerState) getHeartbeatPayload() map[string]any {
	state.mu.Lock()
	defer state.mu.Unlock()

	supportedLanguages := make([]string, 0, len(Languages))
	for lang := range Languages {
		supportedLanguages = append(supportedLanguages, lang)
	}

	return map[string]any{
		"runner_id":             state.RunnerID,
		"hostname":              state.Hostname,
		"status":                state.Status,
		"current_submission_id": state.CurrentSubmissionID,
		"jobs_processed":        state.JobsProcessed,
		"last_verdict":          state.LastVerdict,
		"supported_languages":   supportedLanguages,
		"started_at":            state.StartedAt.Format(time.RFC3339),
		"load": map[string]any{
			"goroutines": runtime.NumGoroutine(),
			"cpus":       runtime.NumCPU(),
			"uptime_sec": int(time.Since(state.StartedAt).Seconds()),
		},
	}
}

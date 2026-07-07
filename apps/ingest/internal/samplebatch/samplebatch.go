// Why: turns an ingest request body into validated samples and sleep sessions, in the units and time precision Postgres stores.
// Must not: touch the database or know who sent the batch.
package samplebatch

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Shub3am/WearWise/apps/ingest/internal/metriccatalog"
	"github.com/Shub3am/WearWise/apps/ingest/internal/retention"
)

const (
	MaxItems              = 5000
	futureSampleAllowance = 24 * time.Hour
	maxExternalUUIDLength = 128
	maxSourceLength       = 256
)

var sleepStageNames = []string{"awake", "asleep", "light", "deep", "rem", "in_bed"}

type Sample struct {
	Metric       string
	ExternalUUID string
	StartAt      time.Time
	EndAt        time.Time
	Value        float64
	Unit         string
	Source       string
}

type SleepStage struct {
	Stage   string    `json:"stage"`
	StartAt time.Time `json:"startAt"`
	EndAt   time.Time `json:"endAt"`
}

type SleepSession struct {
	ExternalUUID string
	StartAt      time.Time
	EndAt        time.Time
	Source       string
	Stages       []SleepStage
}

type Batch struct {
	Samples            []Sample
	SleepSessions      []SleepSession
	SkippedSampleCount int
}

type wireSample struct {
	Metric       string    `json:"metric"`
	ExternalUUID string    `json:"externalUuid"`
	StartAt      time.Time `json:"startAt"`
	EndAt        time.Time `json:"endAt"`
	Value        *float64  `json:"value"`
	Unit         string    `json:"unit"`
	Source       string    `json:"source"`
}

type wireSleepSession struct {
	ExternalUUID string       `json:"externalUuid"`
	StartAt      time.Time    `json:"startAt"`
	EndAt        time.Time    `json:"endAt"`
	Source       string       `json:"source"`
	Stages       []SleepStage `json:"stages"`
}

type wireBatch struct {
	Samples       []wireSample       `json:"samples"`
	SleepSessions []wireSleepSession `json:"sleepSessions"`
}

func Decode(body []byte, now time.Time) (Batch, error) {
	var wire wireBatch
	if err := json.Unmarshal(body, &wire); err != nil {
		return Batch{}, fmt.Errorf("body must be a JSON batch: %w", err)
	}
	if len(wire.Samples)+len(wire.SleepSessions) > MaxItems {
		return Batch{}, fmt.Errorf("a batch holds at most %d samples and sleep sessions together", MaxItems)
	}
	oldestStartAt := now.Add(-retention.RawSampleRetention)
	newestStartAt := now.Add(futureSampleAllowance)
	batch := Batch{
		Samples:       make([]Sample, 0, len(wire.Samples)),
		SleepSessions: make([]SleepSession, 0, len(wire.SleepSessions)),
	}
	for sampleIndex, sample := range wire.Samples {
		if problem := sampleProblem(sample); problem != "" {
			return Batch{}, fmt.Errorf("samples[%d].%s", sampleIndex, problem)
		}
		startAt := storedTime(sample.StartAt)
		if startAt.Before(oldestStartAt) || startAt.After(newestStartAt) {
			batch.SkippedSampleCount++
			continue
		}
		batch.Samples = append(batch.Samples, Sample{
			Metric:       sample.Metric,
			ExternalUUID: sample.ExternalUUID,
			StartAt:      startAt,
			EndAt:        storedTime(sample.EndAt),
			Value:        *sample.Value,
			Unit:         sample.Unit,
			Source:       sample.Source,
		})
	}
	for sessionIndex, session := range wire.SleepSessions {
		if problem := sleepSessionProblem(session); problem != "" {
			return Batch{}, fmt.Errorf("sleepSessions[%d].%s", sessionIndex, problem)
		}
		stages := make([]SleepStage, 0, len(session.Stages))
		for _, stage := range session.Stages {
			stages = append(stages, SleepStage{Stage: stage.Stage, StartAt: storedTime(stage.StartAt), EndAt: storedTime(stage.EndAt)})
		}
		batch.SleepSessions = append(batch.SleepSessions, SleepSession{
			ExternalUUID: session.ExternalUUID,
			StartAt:      storedTime(session.StartAt),
			EndAt:        storedTime(session.EndAt),
			Source:       session.Source,
			Stages:       stages,
		})
	}
	return batch, nil
}

// Postgres timestamptz holds microseconds; comparing and deduplicating at that precision matches what is stored.
func storedTime(wireTime time.Time) time.Time {
	return wireTime.UTC().Truncate(time.Microsecond)
}

func sampleProblem(sample wireSample) string {
	canonicalUnit, known := metriccatalog.CanonicalUnit(sample.Metric)
	// sleep_analysis arrives as sleepSessions, never as samples.
	if !known || sample.Metric == "sleep_analysis" {
		return fmt.Sprintf("metric: %q is not an ingestible metric", sample.Metric)
	}
	if sample.Unit != canonicalUnit {
		return fmt.Sprintf("unit: must be %q for %s, got %q", canonicalUnit, sample.Metric, sample.Unit)
	}
	if sample.Value == nil {
		return "value: is required"
	}
	if problem := textProblem(sample.ExternalUUID, maxExternalUUIDLength); problem != "" {
		return "externalUuid: " + problem
	}
	if problem := textProblem(sample.Source, maxSourceLength); problem != "" {
		return "source: " + problem
	}
	if sample.StartAt.IsZero() {
		return "startAt: is required"
	}
	if sample.EndAt.IsZero() {
		return "endAt: is required"
	}
	if storedTime(sample.EndAt).Before(storedTime(sample.StartAt)) {
		return "endAt: must not be before startAt"
	}
	return ""
}

func sleepSessionProblem(session wireSleepSession) string {
	if problem := textProblem(session.ExternalUUID, maxExternalUUIDLength); problem != "" {
		return "externalUuid: " + problem
	}
	if problem := textProblem(session.Source, maxSourceLength); problem != "" {
		return "source: " + problem
	}
	if session.StartAt.IsZero() {
		return "startAt: is required"
	}
	sessionStartAt := storedTime(session.StartAt)
	sessionEndAt := storedTime(session.EndAt)
	if !isJSONEncodableYear(sessionStartAt) {
		return "startAt: must fall in years 0 to 9999 in UTC"
	}
	if !isJSONEncodableYear(sessionEndAt) {
		return "endAt: must fall in years 0 to 9999 in UTC"
	}
	if !sessionEndAt.After(sessionStartAt) {
		return "endAt: must be after startAt"
	}
	for stageIndex, stage := range session.Stages {
		if !slices.Contains(sleepStageNames, stage.Stage) {
			return fmt.Sprintf("stages[%d].stage: must be one of %s, got %q", stageIndex, strings.Join(sleepStageNames, ", "), stage.Stage)
		}
		stageStartAt := storedTime(stage.StartAt)
		stageEndAt := storedTime(stage.EndAt)
		if stageEndAt.Before(stageStartAt) {
			return fmt.Sprintf("stages[%d].endAt: must not be before startAt", stageIndex)
		}
		if stageStartAt.Before(sessionStartAt) || stageEndAt.After(sessionEndAt) {
			return fmt.Sprintf("stages[%d]: must lie within the session", stageIndex)
		}
	}
	return ""
}

// batchwriter stores stages as JSON, and encoding/json refuses times outside years 0 to 9999. An offset lets a wire
// time inside that range land outside it in UTC. Stages lie within their session, so bounding the session bounds them.
func isJSONEncodableYear(storedAt time.Time) bool {
	return storedAt.Year() >= 0 && storedAt.Year() <= 9999
}

// Postgres text columns reject NUL, so it is refused here as a client error instead of failing the insert.
func textProblem(text string, maxCharacters int) string {
	switch {
	case text == "":
		return "is required"
	case utf8.RuneCountInString(text) > maxCharacters:
		return fmt.Sprintf("must be at most %d characters", maxCharacters)
	case strings.ContainsRune(text, 0):
		return "must not contain NUL"
	}
	return ""
}

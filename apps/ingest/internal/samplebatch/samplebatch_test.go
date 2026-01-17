package samplebatch_test

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
)

var decodeNow = time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)

func validSample() map[string]any {
	return map[string]any{
		"metric":       "heart_rate",
		"externalUuid": "5C0E6F7A-2B1D-4E8F-9A3C-1D2E3F4A5B6C",
		"startAt":      "2026-09-23T10:00:00.123456789+05:30",
		"endAt":        "2026-09-23T10:00:00.123456789+05:30",
		"value":        72.5,
		"unit":         "bpm",
		"source":       "com.apple.health",
	}
}

func validSleepSession() map[string]any {
	return map[string]any{
		"externalUuid": "sleep-2026-09-22",
		"startAt":      "2026-09-22T17:00:00Z",
		"endAt":        "2026-09-23T01:00:00Z",
		"source":       "com.google.android.apps.fitness",
		"stages": []any{
			map[string]any{"stage": "light", "startAt": "2026-09-22T17:00:00Z", "endAt": "2026-09-22T19:00:00Z"},
			map[string]any{"stage": "deep", "startAt": "2026-09-22T19:00:00Z", "endAt": "2026-09-22T20:00:00Z"},
		},
	}
}

func withFields(base map[string]any, overrides map[string]any) map[string]any {
	merged := map[string]any{}
	for fieldName, fieldValue := range base {
		merged[fieldName] = fieldValue
	}
	for fieldName, fieldValue := range overrides {
		if fieldValue == nil {
			delete(merged, fieldName)
			continue
		}
		merged[fieldName] = fieldValue
	}
	return merged
}

func batchBody(t *testing.T, samples []map[string]any, sleepSessions []map[string]any) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{"samples": samples, "sleepSessions": sleepSessions})
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func TestDecodeReturnsSampleInUTCMicroseconds(t *testing.T) {
	batch, err := samplebatch.Decode(batchBody(t, []map[string]any{validSample()}, nil), decodeNow)
	if err != nil {
		t.Fatal(err)
	}
	storedAt := time.Date(2026, 9, 23, 4, 30, 0, 123456000, time.UTC)
	want := []samplebatch.Sample{{
		Metric:       "heart_rate",
		ExternalUUID: "5C0E6F7A-2B1D-4E8F-9A3C-1D2E3F4A5B6C",
		StartAt:      storedAt,
		EndAt:        storedAt,
		Value:        72.5,
		Unit:         "bpm",
		Source:       "com.apple.health",
	}}
	if !reflect.DeepEqual(batch.Samples, want) {
		t.Fatalf("got %+v, want %+v", batch.Samples, want)
	}
}

func TestDecodeReturnsSleepSessionWithStages(t *testing.T) {
	batch, err := samplebatch.Decode(batchBody(t, nil, []map[string]any{validSleepSession()}), decodeNow)
	if err != nil {
		t.Fatal(err)
	}
	want := []samplebatch.SleepSession{{
		ExternalUUID: "sleep-2026-09-22",
		StartAt:      time.Date(2026, 9, 22, 17, 0, 0, 0, time.UTC),
		EndAt:        time.Date(2026, 9, 23, 1, 0, 0, 0, time.UTC),
		Source:       "com.google.android.apps.fitness",
		Stages: []samplebatch.SleepStage{
			{Stage: "light", StartAt: time.Date(2026, 9, 22, 17, 0, 0, 0, time.UTC), EndAt: time.Date(2026, 9, 22, 19, 0, 0, 0, time.UTC)},
			{Stage: "deep", StartAt: time.Date(2026, 9, 22, 19, 0, 0, 0, time.UTC), EndAt: time.Date(2026, 9, 22, 20, 0, 0, 0, time.UTC)},
		},
	}}
	if !reflect.DeepEqual(batch.SleepSessions, want) {
		t.Fatalf("got %+v, want %+v", batch.SleepSessions, want)
	}
}

func TestDecodeGivesSessionWithoutStagesAnEmptyList(t *testing.T) {
	session := withFields(validSleepSession(), map[string]any{"stages": nil})
	batch, err := samplebatch.Decode(batchBody(t, nil, []map[string]any{session}), decodeNow)
	if err != nil {
		t.Fatal(err)
	}
	if batch.SleepSessions[0].Stages == nil || len(batch.SleepSessions[0].Stages) != 0 {
		t.Fatalf("got stages %#v, want an empty non nil slice", batch.SleepSessions[0].Stages)
	}
}

func TestDecodeTruncatesStartTimesThatDifferBelowAMicrosecond(t *testing.T) {
	first := withFields(validSample(), map[string]any{"startAt": "2026-09-23T04:30:00.123456100Z", "endAt": "2026-09-23T04:30:00.123456100Z"})
	second := withFields(validSample(), map[string]any{"startAt": "2026-09-23T04:30:00.123456900Z", "endAt": "2026-09-23T04:30:00.123456900Z"})
	batch, err := samplebatch.Decode(batchBody(t, []map[string]any{first, second}, nil), decodeNow)
	if err != nil {
		t.Fatal(err)
	}
	if batch.Samples[0].StartAt != batch.Samples[1].StartAt {
		t.Fatalf("start times %v and %v differ; Postgres stores both as the same microsecond", batch.Samples[0].StartAt, batch.Samples[1].StartAt)
	}
}

func TestDecodeRejectsInvalidSample(t *testing.T) {
	for _, testCase := range []struct {
		name      string
		overrides map[string]any
		wantError string
	}{
		{"unknown metric", map[string]any{"metric": "blood_glucose"}, `samples[1].metric: "blood_glucose" is not an ingestible metric`},
		{"sleep as a sample", map[string]any{"metric": "sleep_analysis", "unit": "hr"}, `samples[1].metric: "sleep_analysis" is not an ingestible metric`},
		{"wrong unit", map[string]any{"unit": "count/min"}, `samples[1].unit: must be "bpm" for heart_rate, got "count/min"`},
		{"missing value", map[string]any{"value": nil}, `samples[1].value: is required`},
		{"missing external uuid", map[string]any{"externalUuid": nil}, `samples[1].externalUuid: is required`},
		{"long external uuid", map[string]any{"externalUuid": strings.Repeat("a", 129)}, `samples[1].externalUuid: must be at most 128 characters`},
		{"NUL in external uuid", map[string]any{"externalUuid": "abc\x00def"}, `samples[1].externalUuid: must not contain NUL`},
		{"NUL in source", map[string]any{"source": "com.apple.health\x00"}, `samples[1].source: must not contain NUL`},
		{"long source", map[string]any{"source": strings.Repeat("s", 257)}, `samples[1].source: must be at most 256 characters`},
		{"missing start", map[string]any{"startAt": nil}, `samples[1].startAt: is required`},
		{"missing end", map[string]any{"endAt": nil}, `samples[1].endAt: is required`},
		{"end before start", map[string]any{"endAt": "2026-09-23T04:29:59Z"}, `samples[1].endAt: must not be before startAt`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			body := batchBody(t, []map[string]any{validSample(), withFields(validSample(), testCase.overrides)}, nil)
			_, err := samplebatch.Decode(body, decodeNow)
			if err == nil || err.Error() != testCase.wantError {
				t.Fatalf("got %v, want %s", err, testCase.wantError)
			}
		})
	}
}

func TestDecodeRejectsInvalidSleepSession(t *testing.T) {
	for _, testCase := range []struct {
		name      string
		overrides map[string]any
		wantError string
	}{
		{"missing external uuid", map[string]any{"externalUuid": nil}, `sleepSessions[0].externalUuid: is required`},
		{"NUL in source", map[string]any{"source": "watch\x00"}, `sleepSessions[0].source: must not contain NUL`},
		{"missing start", map[string]any{"startAt": nil}, `sleepSessions[0].startAt: is required`},
		{"end equals start", map[string]any{"endAt": "2026-09-22T17:00:00Z"}, `sleepSessions[0].endAt: must be after startAt`},
		{"unknown stage", map[string]any{"stages": []any{
			map[string]any{"stage": "nap", "startAt": "2026-09-22T17:00:00Z", "endAt": "2026-09-22T18:00:00Z"},
		}}, `sleepSessions[0].stages[0].stage: must be one of awake, asleep, light, deep, rem, in_bed, got "nap"`},
		{"stage ends before it starts", map[string]any{"stages": []any{
			map[string]any{"stage": "rem", "startAt": "2026-09-22T18:00:00Z", "endAt": "2026-09-22T17:30:00Z"},
		}}, `sleepSessions[0].stages[0].endAt: must not be before startAt`},
		{"stage outside the session", map[string]any{"stages": []any{
			map[string]any{"stage": "awake", "startAt": "2026-09-23T00:30:00Z", "endAt": "2026-09-23T02:00:00Z"},
		}}, `sleepSessions[0].stages[0]: must lie within the session`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			body := batchBody(t, nil, []map[string]any{withFields(validSleepSession(), testCase.overrides)})
			_, err := samplebatch.Decode(body, decodeNow)
			if err == nil || err.Error() != testCase.wantError {
				t.Fatalf("got %v, want %s", err, testCase.wantError)
			}
		})
	}
}

func TestDecodeRejectsMalformedJSON(t *testing.T) {
	_, err := samplebatch.Decode([]byte(`{"samples": [`), decodeNow)
	if err == nil || !strings.HasPrefix(err.Error(), "body must be a JSON batch: ") {
		t.Fatalf("got %v, want a body must be a JSON batch error", err)
	}
}

func TestDecodeRejectsMoreThanMaxItems(t *testing.T) {
	samples := make([]map[string]any, samplebatch.MaxItems)
	for sampleIndex := range samples {
		samples[sampleIndex] = validSample()
	}
	_, err := samplebatch.Decode(batchBody(t, samples, []map[string]any{validSleepSession()}), decodeNow)
	if err == nil || err.Error() != "a batch holds at most 5000 samples and sleep sessions together" {
		t.Fatalf("got %v, want the batch size error", err)
	}
}

func TestDecodeSkipsSamplesOutsideTheRetentionWindow(t *testing.T) {
	sampleStartingAt := func(startAt time.Time) map[string]any {
		formatted := startAt.Format(time.RFC3339Nano)
		return withFields(validSample(), map[string]any{"startAt": formatted, "endAt": formatted})
	}
	body := batchBody(t, []map[string]any{
		sampleStartingAt(decodeNow.Add(-91 * 24 * time.Hour)),
		sampleStartingAt(decodeNow.Add(-89 * 24 * time.Hour)),
		sampleStartingAt(decodeNow.Add(25 * time.Hour)),
	}, nil)
	batch, err := samplebatch.Decode(body, decodeNow)
	if err != nil {
		t.Fatal(err)
	}
	if batch.SkippedSampleCount != 2 || len(batch.Samples) != 1 {
		t.Fatalf("got %d kept and %d skipped, want 1 kept and 2 skipped", len(batch.Samples), batch.SkippedSampleCount)
	}
	if !batch.Samples[0].StartAt.Equal(decodeNow.Add(-89 * 24 * time.Hour)) {
		t.Fatalf("kept %v, want the 89 day old sample", batch.Samples[0].StartAt)
	}
}

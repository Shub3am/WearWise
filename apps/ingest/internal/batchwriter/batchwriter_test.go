package batchwriter_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/batchwriter"
	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
	"github.com/Shub3am/WearWise/apps/ingest/internal/testdatabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func recentStartAt() time.Time {
	return time.Now().UTC().Truncate(time.Microsecond).Add(-time.Hour)
}

func heartRateSample(externalUUID string, startAt time.Time, beatsPerMinute float64) samplebatch.Sample {
	return samplebatch.Sample{
		Metric:       "heart_rate",
		ExternalUUID: externalUUID,
		StartAt:      startAt,
		EndAt:        startAt,
		Value:        beatsPerMinute,
		Unit:         "bpm",
		Source:       "com.apple.health",
	}
}

func nightOfSleep(externalUUID string, stages []samplebatch.SleepStage) samplebatch.SleepSession {
	return samplebatch.SleepSession{
		ExternalUUID: externalUUID,
		StartAt:      stages[0].StartAt,
		EndAt:        stages[len(stages)-1].EndAt,
		Source:       "com.apple.health",
		Stages:       stages,
	}
}

func writeBatch(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID, batch samplebatch.Batch) {
	t.Helper()
	if err := batchwriter.Write(t.Context(), pool, userID, batch); err != nil {
		t.Fatal(err)
	}
}

func storedValuesByExternalUUID(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) map[string]float64 {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT external_uuid, value FROM health_samples WHERE user_id = $1", userID)
	if err != nil {
		t.Fatal(err)
	}
	valuesByExternalUUID := map[string]float64{}
	var externalUUID string
	var value float64
	_, err = pgx.ForEachRow(rows, []any{&externalUUID, &value}, func() error {
		valuesByExternalUUID[externalUUID] = value
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return valuesByExternalUUID
}

func storedStages(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) []samplebatch.SleepStage {
	t.Helper()
	var stages []samplebatch.SleepStage
	if err := pool.QueryRow(t.Context(), "SELECT stages FROM sleep_sessions WHERE user_id = $1", userID).Scan(&stages); err != nil {
		t.Fatal(err)
	}
	return stages
}

func rowVersions(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `
		SELECT xmin::text FROM health_samples WHERE user_id = $1
		UNION ALL
		SELECT xmin::text FROM sleep_sessions WHERE user_id = $1`, userID)
	if err != nil {
		t.Fatal(err)
	}
	versions, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	return versions
}

func threeStages(startAt time.Time) []samplebatch.SleepStage {
	return []samplebatch.SleepStage{
		{Stage: "light", StartAt: startAt, EndAt: startAt.Add(time.Hour)},
		{Stage: "deep", StartAt: startAt.Add(time.Hour), EndAt: startAt.Add(2 * time.Hour)},
		{Stage: "rem", StartAt: startAt.Add(2 * time.Hour), EndAt: startAt.Add(3 * time.Hour)},
	}
}

func TestWriteStoresSamplesAndSleepSessions(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	startAt := recentStartAt()
	stages := threeStages(startAt.Add(-8 * time.Hour))
	writeBatch(t, pool, userID, samplebatch.Batch{
		Samples:       []samplebatch.Sample{heartRateSample("hr-1", startAt, 61), heartRateSample("hr-2", startAt.Add(time.Minute), 64)},
		SleepSessions: []samplebatch.SleepSession{nightOfSleep("night-1", stages)},
	})
	if got := storedValuesByExternalUUID(t, pool, userID); !reflect.DeepEqual(got, map[string]float64{"hr-1": 61, "hr-2": 64}) {
		t.Fatalf("got samples %v", got)
	}
	if got := storedStages(t, pool, userID); !reflect.DeepEqual(got, stages) {
		t.Fatalf("got stages %+v, want %+v", got, stages)
	}
}

func TestWriteResentBatchChangesNoRow(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	startAt := recentStartAt()
	batch := samplebatch.Batch{
		Samples:       []samplebatch.Sample{heartRateSample("hr-1", startAt, 61)},
		SleepSessions: []samplebatch.SleepSession{nightOfSleep("night-1", threeStages(startAt.Add(-8*time.Hour)))},
	}
	writeBatch(t, pool, userID, batch)
	versionsAfterFirstWrite := rowVersions(t, pool, userID)
	writeBatch(t, pool, userID, batch)
	if versionsAfterResend := rowVersions(t, pool, userID); !reflect.DeepEqual(versionsAfterResend, versionsAfterFirstWrite) {
		t.Fatalf("row versions changed from %v to %v; a resend must not rewrite rows", versionsAfterFirstWrite, versionsAfterResend)
	}
}

func TestWriteUpdatesChangedSampleValue(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	startAt := recentStartAt()
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{heartRateSample("hr-1", startAt, 61)}})
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{heartRateSample("hr-1", startAt, 66)}})
	if got := storedValuesByExternalUUID(t, pool, userID); !reflect.DeepEqual(got, map[string]float64{"hr-1": 66}) {
		t.Fatalf("got samples %v, want hr-1 updated to 66", got)
	}
}

func TestWriteKeepsTheLastDuplicateInABatch(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	startAt := recentStartAt()
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		heartRateSample("hr-1", startAt, 60),
		heartRateSample("hr-1", startAt, 70),
	}})
	if got := storedValuesByExternalUUID(t, pool, userID); !reflect.DeepEqual(got, map[string]float64{"hr-1": 70}) {
		t.Fatalf("got samples %v, want the later duplicate (70)", got)
	}
}

func TestWriteStoresSamplesAcrossMonths(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	startAt := recentStartAt()
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		heartRateSample("hr-now", startAt, 61),
		heartRateSample("hr-40-days-ago", startAt.Add(-40*24*time.Hour), 58),
	}})
	if got := storedValuesByExternalUUID(t, pool, userID); !reflect.DeepEqual(got, map[string]float64{"hr-now": 61, "hr-40-days-ago": 58}) {
		t.Fatalf("got samples %v", got)
	}
}

func TestWriteUpdatesChangedSleepStages(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	stages := threeStages(recentStartAt().Add(-8 * time.Hour))
	writeBatch(t, pool, userID, samplebatch.Batch{SleepSessions: []samplebatch.SleepSession{nightOfSleep("night-1", stages)}})
	revisedStages := append([]samplebatch.SleepStage{}, stages...)
	revisedStages[1].Stage = "asleep"
	writeBatch(t, pool, userID, samplebatch.Batch{SleepSessions: []samplebatch.SleepSession{nightOfSleep("night-1", revisedStages)}})
	if got := storedStages(t, pool, userID); !reflect.DeepEqual(got, revisedStages) {
		t.Fatalf("got stages %+v, want %+v", got, revisedStages)
	}
}

package recompute_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/batchwriter"
	"github.com/Shub3am/WearWise/apps/ingest/internal/recompute"
	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
	"github.com/Shub3am/WearWise/apps/ingest/internal/store"
	"github.com/Shub3am/WearWise/apps/ingest/internal/testdatabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func sample(metric, externalUUID, source string, startAt time.Time, value float64) samplebatch.Sample {
	return samplebatch.Sample{
		Metric:       metric,
		ExternalUUID: externalUUID,
		StartAt:      startAt,
		EndAt:        startAt,
		Value:        value,
		Unit:         "count",
		Source:       source,
	}
}

func writeBatch(t testing.TB, pool *pgxpool.Pool, userID uuid.UUID, batch samplebatch.Batch) {
	t.Helper()
	if err := batchwriter.Write(t.Context(), pool, userID, batch); err != nil {
		t.Fatal(err)
	}
}

func setTimeZone(t testing.TB, pool *pgxpool.Pool, userID uuid.UUID, timeZone string) {
	t.Helper()
	if _, err := pool.Exec(t.Context(), "UPDATE users SET timezone = $2 WHERE id = $1", userID, timeZone); err != nil {
		t.Fatal(err)
	}
}

func queuedRow(t testing.TB, pool *pgxpool.Pool, userID uuid.UUID) store.ListUsersDueForRecomputeRow {
	t.Helper()
	queued := store.ListUsersDueForRecomputeRow{UserID: userID}
	err := pool.QueryRow(t.Context(),
		"SELECT from_local_date, generation FROM metrics_recompute_queue WHERE user_id = $1", userID,
	).Scan(&queued.FromLocalDate, &queued.Generation)
	if err != nil {
		t.Fatalf("read metrics_recompute_queue: %v", err)
	}
	return queued
}

func queueRowExists(t testing.TB, pool *pgxpool.Pool, userID uuid.UUID) bool {
	t.Helper()
	var exists bool
	err := pool.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM metrics_recompute_queue WHERE user_id = $1)", userID).Scan(&exists)
	if err != nil {
		t.Fatal(err)
	}
	return exists
}

func recomputeUser(t testing.TB, pool *pgxpool.Pool, userID uuid.UUID, now time.Time) {
	t.Helper()
	if err := recompute.RecomputeUser(t.Context(), pool, queuedRow(t, pool, userID), now); err != nil {
		t.Fatal(err)
	}
}

type storedAggregate struct {
	avgValue    float64
	sumValue    float64
	sampleCount int32
}

func aggregateOn(t testing.TB, pool *pgxpool.Pool, userID uuid.UUID, localDate time.Time, metric string) (storedAggregate, bool) {
	t.Helper()
	var aggregate storedAggregate
	err := pool.QueryRow(t.Context(),
		"SELECT avg_value, sum_value, sample_count FROM daily_aggregates WHERE user_id = $1 AND local_date = $2 AND metric = $3",
		userID, localDate, metric,
	).Scan(&aggregate.avgValue, &aggregate.sumValue, &aggregate.sampleCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return storedAggregate{}, false
	}
	if err != nil {
		t.Fatal(err)
	}
	return aggregate, true
}

func date(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func TestRecomputeUserTakesStepsFromTheBusiestSource(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	morning := time.Date(2026, 8, 20, 9, 0, 0, 0, time.UTC)
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("step_count", "watch-1", "watch", morning, 500),
		sample("step_count", "watch-2", "watch", morning.Add(time.Hour), 500),
		sample("step_count", "phone-1", "phone", morning, 1200),
		sample("heart_rate", "hr-watch", "watch", morning, 60),
		sample("heart_rate", "hr-strap", "strap", morning, 80),
	}})
	recomputeUser(t, pool, userID, time.Date(2026, 8, 21, 6, 0, 0, 0, time.UTC))
	steps, _ := aggregateOn(t, pool, userID, date(2026, 8, 20), "step_count")
	if steps.sumValue != 1200 {
		t.Errorf("step_count sum = %v, want 1200 from the phone alone, not 2200", steps.sumValue)
	}
	heartRate, _ := aggregateOn(t, pool, userID, date(2026, 8, 20), "heart_rate")
	if heartRate.avgValue != 70 || heartRate.sampleCount != 2 {
		t.Errorf("heart_rate = %+v, want the average 70 over both sources", heartRate)
	}
}

func TestRecomputeUserDatesSamplesByTheUsersLocalDate(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	setTimeZone(t, pool, userID, "Asia/Kolkata")
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("heart_rate", "hr-before-midnight", "watch", time.Date(2026, 8, 20, 18, 0, 0, 0, time.UTC), 60),
		sample("heart_rate", "hr-after-midnight", "watch", time.Date(2026, 8, 20, 19, 0, 0, 0, time.UTC), 80),
	}})
	recomputeUser(t, pool, userID, time.Date(2026, 8, 21, 6, 0, 0, 0, time.UTC))
	for localDate, wantAverage := range map[time.Time]float64{date(2026, 8, 20): 60, date(2026, 8, 21): 80} {
		if aggregate, _ := aggregateOn(t, pool, userID, localDate, "heart_rate"); aggregate.avgValue != wantAverage {
			t.Errorf("heart_rate on %s = %v, want %v", localDate.Format(time.DateOnly), aggregate.avgValue, wantAverage)
		}
	}
}

func TestRecomputeUserKeepsAggregatesOlderThanRetention(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	oldDate := date(2026, 5, 1)
	if _, err := pool.Exec(t.Context(),
		`INSERT INTO daily_aggregates (user_id, local_date, metric, min_value, avg_value, max_value, sum_value, sample_count)
		VALUES ($1, $2, 'heart_rate', 55, 55, 55, 55, 1)`, userID, oldDate); err != nil {
		t.Fatal(err)
	}
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("heart_rate", "hr-old", "watch", oldDate.Add(9*time.Hour), 99),
	}})
	recomputeUser(t, pool, userID, time.Date(2026, 8, 21, 6, 0, 0, 0, time.UTC))
	if aggregate, _ := aggregateOn(t, pool, userID, oldDate, "heart_rate"); aggregate.avgValue != 55 {
		t.Fatalf("heart_rate on 2026-05-01 = %v, want the stored 55 kept outside the 90 day window", aggregate.avgValue)
	}
}

func TestRecomputeUserDeletesTheQueueRowWhenDone(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("heart_rate", "hr-1", "watch", time.Date(2026, 8, 20, 9, 0, 0, 0, time.UTC), 60),
	}})
	recomputeUser(t, pool, userID, time.Date(2026, 8, 21, 6, 0, 0, 0, time.UTC))
	if queueRowExists(t, pool, userID) {
		t.Fatal("queue row still exists after a finished recompute")
	}
}

func TestRecomputeUserLeavesTheQueueRowWhenABatchArrivedMeanwhile(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("heart_rate", "hr-1", "watch", time.Date(2026, 8, 20, 9, 0, 0, 0, time.UTC), 60),
	}})
	claimed := queuedRow(t, pool, userID)
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("heart_rate", "hr-2", "watch", time.Date(2026, 8, 20, 10, 0, 0, 0, time.UTC), 70),
	}})
	if err := recompute.RecomputeUser(t.Context(), pool, claimed, time.Date(2026, 8, 21, 6, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if generation := queuedRow(t, pool, userID).Generation; generation != 2 {
		t.Fatalf("queue row generation = %d, want the newer batch's 2 kept for the next pass", generation)
	}
}

func TestRecomputeUserWaitsForAnAccountDeletionThenStops(t *testing.T) {
	pool := testdatabase.Open(t)
	userID, _ := testdatabase.CreateConsentedUser(t, pool)
	writeBatch(t, pool, userID, samplebatch.Batch{Samples: []samplebatch.Sample{
		sample("heart_rate", "hr-1", "watch", time.Date(2026, 8, 20, 9, 0, 0, 0, time.UTC), 60),
	}})
	claimed := queuedRow(t, pool, userID)
	deletion, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer deletion.Rollback(t.Context())
	if _, err := deletion.Exec(t.Context(), "DELETE FROM users WHERE id = $1", userID); err != nil {
		t.Fatal(err)
	}
	recomputeResult := make(chan error, 1)
	go func() {
		recomputeResult <- recompute.RecomputeUser(t.Context(), pool, claimed, time.Date(2026, 8, 21, 6, 0, 0, 0, time.UTC))
	}()
	waitUntilBlockedOnTheUsersRow(t, pool)
	if err := deletion.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := <-recomputeResult; err != nil {
		t.Fatalf("RecomputeUser after the account was deleted = %v, want nil", err)
	}
}

func waitUntilBlockedOnTheUsersRow(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	for range 100 {
		var waiting bool
		err := pool.QueryRow(t.Context(),
			`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
			WHERE wait_event_type = 'Lock' AND query LIKE '%FOR KEY SHARE%' AND datname = current_database())`,
		).Scan(&waiting)
		if err != nil {
			t.Fatal(err)
		}
		if waiting {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("RecomputeUser never waited on the users row")
}

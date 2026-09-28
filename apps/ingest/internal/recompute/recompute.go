// Why: rebuilds one user's derived metrics for the local dates a stored batch changed, in one transaction.
// Must not: parse batches or talk to BullMQ; it only leaves outbox rows for the relay.
package recompute

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/localdate"
	"github.com/Shub3am/WearWise/apps/ingest/internal/retention"
	"github.com/Shub3am/WearWise/apps/ingest/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// cumulativeMetrics add up over a day, so a day's value is one source's total. Two sources that both count the same
// steps would double them if summed, so the busiest source wins. Every other metric's day value is its average.
var cumulativeMetrics = []string{
	"exercise_time",
	"stand_hours",
	"stand_time",
	"step_count",
	"walking_running_distance",
	"flights_climbed",
	"active_energy",
	"basal_energy",
	"time_in_daylight",
}

// RecomputeUser rebuilds queued's user from queued.FromLocalDate through today. It deletes the queue row only if no
// batch arrived meanwhile; a newer generation leaves the row for the next pass.
func RecomputeUser(ctx context.Context, pool *pgxpool.Pool, queued store.ListUsersDueForRecomputeRow, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		queries := store.New(tx)
		locked, err := queries.TryLockUserMetrics(ctx, queued.UserID)
		if err != nil {
			return fmt.Errorf("lock user metrics: %w", err)
		}
		if !locked {
			return nil
		}
		// FindUserTimeZone takes the users row FOR KEY SHARE before any child row is touched. Without it, an account
		// deletion that already locked the users row could wait on rows this transaction deleted, while this
		// transaction's foreign key check waits on the users row: a deadlock.
		timeZone, err := queries.FindUserTimeZone(ctx, queued.UserID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("find user time zone: %w", err)
		}
		location, err := time.LoadLocation(timeZone)
		if err != nil {
			return fmt.Errorf("load time zone %q: %w", timeZone, err)
		}
		fromLocalDate, toLocalDate := recomputeWindow(queued.FromLocalDate, now, location)
		if err := queries.DeleteDailyAggregates(ctx, store.DeleteDailyAggregatesParams{
			UserID:        queued.UserID,
			FromLocalDate: fromLocalDate,
			ToLocalDate:   toLocalDate,
		}); err != nil {
			return fmt.Errorf("delete daily aggregates: %w", err)
		}
		if _, err := queries.InsertDailyAggregates(ctx, store.InsertDailyAggregatesParams{
			UserID:            queued.UserID,
			TimeZone:          timeZone,
			FromLocalDate:     fromLocalDate,
			ToLocalDate:       toLocalDate,
			CumulativeMetrics: cumulativeMetrics,
		}); err != nil {
			return fmt.Errorf("insert daily aggregates: %w", err)
		}
		if err := queries.FinishMetricsRecompute(ctx, store.FinishMetricsRecomputeParams{
			UserID:     queued.UserID,
			Generation: queued.Generation,
		}); err != nil {
			return fmt.Errorf("finish metrics recompute: %w", err)
		}
		return nil
	})
}

// recomputeWindow starts no earlier than the first local date whose raw samples retention still holds in full, so a
// rebuild never replaces a day's aggregates with the part of it that is left.
func recomputeWindow(queuedFromLocalDate, now time.Time, location *time.Location) (fromLocalDate, toLocalDate time.Time) {
	fromLocalDate = queuedFromLocalDate
	if oldestCompleteDate := localdate.Of(now.Add(-retention.RawSampleRetention), location).AddDate(0, 0, 1); fromLocalDate.Before(oldestCompleteDate) {
		fromLocalDate = oldestCompleteDate
	}
	toLocalDate = localdate.Of(now, location)
	if toLocalDate.Before(fromLocalDate) {
		toLocalDate = fromLocalDate
	}
	return fromLocalDate, toLocalDate
}

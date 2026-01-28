// Why: stores one validated batch for one user so that resending it changes nothing.
// Must not: validate input or decide who the user is.
package batchwriter

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
	"github.com/Shub3am/WearWise/apps/ingest/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type sampleKey struct {
	metric       string
	externalUUID string
	startAt      time.Time
}

func Write(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, batch samplebatch.Batch) error {
	// Postgres rejects an ON CONFLICT DO UPDATE that touches the same row twice in one statement.
	samples := lastByKey(batch.Samples, func(sample samplebatch.Sample) sampleKey {
		return sampleKey{metric: sample.Metric, externalUUID: sample.ExternalUUID, startAt: sample.StartAt}
	})
	sleepSessions := lastByKey(batch.SleepSessions, func(session samplebatch.SleepSession) string {
		return session.ExternalUUID
	})
	queries := store.New(pool)
	// Partitions are ensured before the transaction, so the lock that creates one is not held while rows are written.
	ensuredMonths := map[time.Time]bool{}
	for _, sample := range samples {
		monthStart := time.Date(sample.StartAt.Year(), sample.StartAt.Month(), 1, 0, 0, 0, 0, time.UTC)
		if ensuredMonths[monthStart] {
			continue
		}
		if err := queries.EnsureHealthSamplesPartition(ctx, monthStart); err != nil {
			return fmt.Errorf("ensure health_samples partition for %s: %w", monthStart.Format("2006-01"), err)
		}
		ensuredMonths[monthStart] = true
	}
	sleepSessionParams, err := sleepSessionColumns(userID, sleepSessions)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		transactionQueries := queries.WithTx(tx)
		if len(samples) > 0 {
			if _, err := transactionQueries.UpsertHealthSamples(ctx, healthSampleColumns(userID, samples)); err != nil {
				return fmt.Errorf("upsert health samples: %w", err)
			}
		}
		if len(sleepSessions) > 0 {
			if _, err := transactionQueries.UpsertSleepSessions(ctx, sleepSessionParams); err != nil {
				return fmt.Errorf("upsert sleep sessions: %w", err)
			}
		}
		return nil
	})
}

func healthSampleColumns(userID uuid.UUID, samples []samplebatch.Sample) store.UpsertHealthSamplesParams {
	columns := store.UpsertHealthSamplesParams{
		UserID:        userID,
		Metrics:       make([]string, len(samples)),
		ExternalUuids: make([]string, len(samples)),
		StartAts:      make([]time.Time, len(samples)),
		EndAts:        make([]time.Time, len(samples)),
		SampleValues:  make([]float64, len(samples)),
		Units:         make([]string, len(samples)),
		Sources:       make([]string, len(samples)),
	}
	for sampleIndex, sample := range samples {
		columns.Metrics[sampleIndex] = sample.Metric
		columns.ExternalUuids[sampleIndex] = sample.ExternalUUID
		columns.StartAts[sampleIndex] = sample.StartAt
		columns.EndAts[sampleIndex] = sample.EndAt
		columns.SampleValues[sampleIndex] = sample.Value
		columns.Units[sampleIndex] = sample.Unit
		columns.Sources[sampleIndex] = sample.Source
	}
	return columns
}

func sleepSessionColumns(userID uuid.UUID, sessions []samplebatch.SleepSession) (store.UpsertSleepSessionsParams, error) {
	columns := store.UpsertSleepSessionsParams{
		UserID:        userID,
		ExternalUuids: make([]string, len(sessions)),
		StartAts:      make([]time.Time, len(sessions)),
		EndAts:        make([]time.Time, len(sessions)),
		Sources:       make([]string, len(sessions)),
		Stages:        make([][]byte, len(sessions)),
	}
	for sessionIndex, session := range sessions {
		stagesJSON, err := json.Marshal(session.Stages)
		if err != nil {
			return store.UpsertSleepSessionsParams{}, fmt.Errorf("encode stages of sleep session %s: %w", session.ExternalUUID, err)
		}
		columns.ExternalUuids[sessionIndex] = session.ExternalUUID
		columns.StartAts[sessionIndex] = session.StartAt
		columns.EndAts[sessionIndex] = session.EndAt
		columns.Sources[sessionIndex] = session.Source
		columns.Stages[sessionIndex] = stagesJSON
	}
	return columns, nil
}

// lastByKey keeps the last item for each key, in the order keys were first seen.
func lastByKey[Item any, Key comparable](items []Item, keyOf func(Item) Key) []Item {
	positionByKey := make(map[Key]int, len(items))
	uniqueItems := make([]Item, 0, len(items))
	for _, item := range items {
		key := keyOf(item)
		if position, seen := positionByKey[key]; seen {
			uniqueItems[position] = item
			continue
		}
		positionByKey[key] = len(uniqueItems)
		uniqueItems = append(uniqueItems, item)
	}
	return uniqueItems
}

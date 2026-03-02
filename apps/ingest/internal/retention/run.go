package retention

import (
	"context"
	"log/slog"
	"time"
)

const dropInterval = 24 * time.Hour

func Run(ctx context.Context, dropPartitionsBefore func(context.Context, time.Time) (int32, error), logger *slog.Logger) {
	for {
		cutoff := time.Now().Add(-RawSampleRetention)
		droppedCount, err := dropPartitionsBefore(ctx, cutoff)
		if err != nil {
			logger.Error("drop expired health_samples partitions failed", "cutoff", cutoff, "error", err)
		} else if droppedCount > 0 {
			logger.Info("dropped expired health_samples partitions", "cutoff", cutoff, "dropped_count", droppedCount)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(dropInterval):
		}
	}
}

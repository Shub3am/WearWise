package retention_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"testing/synctest"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/retention"
)

type recordedDrops struct {
	cutoffs []time.Time
	failAt  int
}

func (drops *recordedDrops) dropPartitionsBefore(_ context.Context, cutoff time.Time) (int32, error) {
	drops.cutoffs = append(drops.cutoffs, cutoff)
	if len(drops.cutoffs) == drops.failAt {
		return 0, errors.New("database unavailable")
	}
	return 1, nil
}

// runForTwoDays runs Run in a synctest bubble, whose fake clock only moves when every goroutine is blocked.
func runForTwoDays(t *testing.T, drops *recordedDrops) time.Time {
	t.Helper()
	var startedAt time.Time
	synctest.Test(t, func(t *testing.T) {
		startedAt = time.Now()
		ctx, cancel := context.WithCancel(t.Context())
		stopped := make(chan struct{})
		go func() {
			retention.Run(ctx, drops.dropPartitionsBefore, slog.New(slog.DiscardHandler))
			close(stopped)
		}()
		time.Sleep(48*time.Hour + time.Minute)
		cancel()
		<-stopped
	})
	return startedAt
}

func TestRunDropsAtStartAndEveryDay(t *testing.T) {
	drops := &recordedDrops{}
	startedAt := runForTwoDays(t, drops)
	firstCutoff := startedAt.Add(-retention.RawSampleRetention)
	want := []time.Time{firstCutoff, firstCutoff.Add(24 * time.Hour), firstCutoff.Add(48 * time.Hour)}
	if len(drops.cutoffs) != len(want) {
		t.Fatalf("got cutoffs %v, want %v", drops.cutoffs, want)
	}
	for dropIndex, cutoff := range drops.cutoffs {
		if !cutoff.Equal(want[dropIndex]) {
			t.Fatalf("got cutoffs %v, want %v", drops.cutoffs, want)
		}
	}
}

func TestRunKeepsGoingAfterAFailedDrop(t *testing.T) {
	drops := &recordedDrops{failAt: 1}
	runForTwoDays(t, drops)
	if len(drops.cutoffs) != 3 {
		t.Fatalf("got %d drops, want 3 (the first failed, the next two still ran)", len(drops.cutoffs))
	}
}

package baseline_test

import (
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/baseline"
)

var scoredDate = time.Date(2026, 8, 30, 0, 0, 0, 0, time.UTC)

// alternatingDays gives the dayCount days before scoredDate the values 60, 62, 60, 62 and so on.
func alternatingDays(dayCount int) map[time.Time]float64 {
	valueByLocalDate := make(map[time.Time]float64)
	for daysBack := 1; daysBack <= dayCount; daysBack++ {
		valueByLocalDate[scoredDate.AddDate(0, 0, -daysBack)] = 60 + float64(daysBack%2)*2
	}
	return valueByLocalDate
}

func TestComputeNeedsFourteenDays(t *testing.T) {
	if _, ok := baseline.Compute(alternatingDays(13), scoredDate, 1); ok {
		t.Error("13 days produced a baseline, want none")
	}
	if _, ok := baseline.Compute(alternatingDays(14), scoredDate, 1); !ok {
		t.Error("14 days produced no baseline, want one")
	}
}

func TestComputeGivesMeanStddevAndZScore(t *testing.T) {
	computed, ok := baseline.Compute(alternatingDays(28), scoredDate, 0.5)
	if !ok {
		t.Fatal("no baseline")
	}
	if computed.Mean != 61 || computed.Stddev != 1 || computed.DayCount != 28 {
		t.Fatalf("got %+v, want mean 61, stddev 1, 28 days", computed)
	}
	if z := computed.ZScore(64); z != 3 {
		t.Fatalf("ZScore(64) = %v, want 3", z)
	}
}

func TestComputeAppliesTheStddevFloor(t *testing.T) {
	computed, _ := baseline.Compute(alternatingDays(28), scoredDate, 3)
	if computed.Stddev != 3 {
		t.Fatalf("Stddev = %v, want the floor 3", computed.Stddev)
	}
}

func TestComputeUsesOnlyTheTwentyEightDaysBefore(t *testing.T) {
	valueByLocalDate := alternatingDays(28)
	valueByLocalDate[scoredDate] = 500
	valueByLocalDate[scoredDate.AddDate(0, 0, -29)] = 500
	computed, _ := baseline.Compute(valueByLocalDate, scoredDate, 0.5)
	if computed.Mean != 61 || computed.DayCount != 28 {
		t.Fatalf("got %+v, want mean 61 over 28 days", computed)
	}
}

package sleepnight_test

import (
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
	"github.com/Shub3am/WearWise/apps/ingest/internal/sleepnight"
)

func kolkata(t *testing.T) *time.Location {
	t.Helper()
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	return location
}

func at(t *testing.T, value string) time.Time {
	t.Helper()
	instant, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t.Fatal(err)
	}
	return instant
}

func stage(t *testing.T, name, startAt, endAt string) samplebatch.SleepStage {
	return samplebatch.SleepStage{Stage: name, StartAt: at(t, startAt), EndAt: at(t, endAt)}
}

func onlyNight(t *testing.T, nights map[time.Time]sleepnight.Night) sleepnight.Night {
	t.Helper()
	if len(nights) != 1 {
		t.Fatalf("got %d nights, want 1", len(nights))
	}
	for _, night := range nights {
		return night
	}
	return sleepnight.Night{}
}

func TestNightsByLocalDateScoresAStagedNight(t *testing.T) {
	session := sleepnight.Session{
		StartAt: at(t, "2026-08-14T22:00:00+05:30"),
		EndAt:   at(t, "2026-08-15T06:00:00+05:30"),
		Stages: []samplebatch.SleepStage{
			stage(t, "awake", "2026-08-14T22:00:00+05:30", "2026-08-14T22:30:00+05:30"),
			stage(t, "light", "2026-08-14T22:30:00+05:30", "2026-08-15T01:30:00+05:30"),
			stage(t, "deep", "2026-08-15T01:30:00+05:30", "2026-08-15T02:30:00+05:30"),
			stage(t, "light", "2026-08-15T02:30:00+05:30", "2026-08-15T04:30:00+05:30"),
			stage(t, "rem", "2026-08-15T04:30:00+05:30", "2026-08-15T05:30:00+05:30"),
			stage(t, "awake", "2026-08-15T05:30:00+05:30", "2026-08-15T06:00:00+05:30"),
		},
	}
	night := onlyNight(t, sleepnight.NightsByLocalDate([]sleepnight.Session{session}, kolkata(t)))
	if !night.LocalDate.Equal(time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("LocalDate = %s, want 2026-08-15", night.LocalDate)
	}
	if night.AsleepMinutes != 420 {
		t.Errorf("AsleepMinutes = %v, want 420", night.AsleepMinutes)
	}
	if night.Efficiency == nil || *night.Efficiency != 0.875 {
		t.Errorf("Efficiency = %v, want 0.875", night.Efficiency)
	}
	if night.DeepAndRemShare == nil || *night.DeepAndRemShare != 120.0/420 {
		t.Errorf("DeepAndRemShare = %v, want %v", night.DeepAndRemShare, 120.0/420)
	}
	if night.BedtimeMinute != 600 {
		t.Errorf("BedtimeMinute = %v, want 600 (22:00 is 600 minutes after noon)", night.BedtimeMinute)
	}
}

func TestNightsByLocalDateKeepsTheLongerSleepOnADate(t *testing.T) {
	nap := sleepnight.Session{
		StartAt: at(t, "2026-08-15T14:00:00+05:30"),
		EndAt:   at(t, "2026-08-15T15:00:00+05:30"),
		Stages:  []samplebatch.SleepStage{stage(t, "asleep", "2026-08-15T14:00:00+05:30", "2026-08-15T15:00:00+05:30")},
	}
	night := sleepnight.Session{
		StartAt: at(t, "2026-08-14T23:00:00+05:30"),
		EndAt:   at(t, "2026-08-15T06:00:00+05:30"),
		Stages:  []samplebatch.SleepStage{stage(t, "asleep", "2026-08-14T23:00:00+05:30", "2026-08-15T06:00:00+05:30")},
	}
	for _, order := range [][]sleepnight.Session{{nap, night}, {night, nap}} {
		got := onlyNight(t, sleepnight.NightsByLocalDate(order, kolkata(t)))
		if got.AsleepMinutes != 420 {
			t.Errorf("AsleepMinutes = %v, want 420 from the night, not the nap", got.AsleepMinutes)
		}
	}
}

func TestNightsByLocalDateTreatsAnInBedOnlySessionAsAsleep(t *testing.T) {
	session := sleepnight.Session{
		StartAt: at(t, "2026-08-14T23:00:00+05:30"),
		EndAt:   at(t, "2026-08-15T07:00:00+05:30"),
		Stages:  []samplebatch.SleepStage{stage(t, "in_bed", "2026-08-14T23:00:00+05:30", "2026-08-15T07:00:00+05:30")},
	}
	night := onlyNight(t, sleepnight.NightsByLocalDate([]sleepnight.Session{session}, kolkata(t)))
	if night.AsleepMinutes != 480 || night.Efficiency != nil || night.DeepAndRemShare != nil {
		t.Fatalf("got %+v, want 480 asleep minutes and no efficiency or share", night)
	}
}

func TestNightsByLocalDateCountsOverlappingStagesOnce(t *testing.T) {
	session := sleepnight.Session{
		StartAt: at(t, "2026-08-14T23:00:00+05:30"),
		EndAt:   at(t, "2026-08-15T03:00:00+05:30"),
		Stages: []samplebatch.SleepStage{
			stage(t, "asleep", "2026-08-14T23:00:00+05:30", "2026-08-15T02:00:00+05:30"),
			stage(t, "deep", "2026-08-15T00:00:00+05:30", "2026-08-15T03:00:00+05:30"),
		},
	}
	night := onlyNight(t, sleepnight.NightsByLocalDate([]sleepnight.Session{session}, kolkata(t)))
	if night.AsleepMinutes != 240 {
		t.Errorf("AsleepMinutes = %v, want 240", night.AsleepMinutes)
	}
	if night.DeepAndRemShare == nil || *night.DeepAndRemShare != 180.0/240 {
		t.Errorf("DeepAndRemShare = %v, want 0.75", night.DeepAndRemShare)
	}
}

func TestNightsByLocalDateLeavesShareUnknownWithoutStagedSleep(t *testing.T) {
	session := sleepnight.Session{
		StartAt: at(t, "2026-08-14T23:00:00+05:30"),
		EndAt:   at(t, "2026-08-15T07:00:00+05:30"),
		Stages: []samplebatch.SleepStage{
			stage(t, "in_bed", "2026-08-14T23:00:00+05:30", "2026-08-15T07:00:00+05:30"),
			stage(t, "asleep", "2026-08-14T23:30:00+05:30", "2026-08-15T06:30:00+05:30"),
		},
	}
	night := onlyNight(t, sleepnight.NightsByLocalDate([]sleepnight.Session{session}, kolkata(t)))
	if night.Efficiency == nil || *night.Efficiency != 420.0/480 {
		t.Errorf("Efficiency = %v, want 0.875", night.Efficiency)
	}
	if night.DeepAndRemShare != nil {
		t.Errorf("DeepAndRemShare = %v, want nil", *night.DeepAndRemShare)
	}
}

func TestNightsByLocalDateDatesByTheLocalEndDate(t *testing.T) {
	session := sleepnight.Session{
		StartAt: at(t, "2026-08-14T17:00:00Z"),
		EndAt:   at(t, "2026-08-14T20:00:00Z"),
		Stages:  []samplebatch.SleepStage{stage(t, "asleep", "2026-08-14T17:00:00Z", "2026-08-14T20:00:00Z")},
	}
	night := onlyNight(t, sleepnight.NightsByLocalDate([]sleepnight.Session{session}, kolkata(t)))
	if !night.LocalDate.Equal(time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("LocalDate = %s, want 2026-08-15 (20:00Z is 01:30 IST)", night.LocalDate)
	}
}

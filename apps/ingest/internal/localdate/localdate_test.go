package localdate_test

import (
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/localdate"
)

func TestOfUsesTheLocalCalendarDate(t *testing.T) {
	kolkata, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		instant time.Time
		want    time.Time
	}{
		{time.Date(2026, 8, 14, 18, 29, 59, 0, time.UTC), time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC)},
		{time.Date(2026, 8, 14, 18, 30, 0, 0, time.UTC), time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC)},
	}
	for _, testCase := range cases {
		if got := localdate.Of(testCase.instant, kolkata); !got.Equal(testCase.want) {
			t.Errorf("Of(%s) = %s, want %s", testCase.instant, got, testCase.want)
		}
	}
}

func TestOfFollowsDaylightSavingTime(t *testing.T) {
	newYork, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	// New York moved from UTC-5 to UTC-4 at 2026-03-08 07:00 UTC.
	cases := []struct {
		instant time.Time
		want    time.Time
	}{
		{time.Date(2026, 3, 8, 4, 59, 0, 0, time.UTC), time.Date(2026, 3, 7, 0, 0, 0, 0, time.UTC)},
		{time.Date(2026, 3, 9, 3, 59, 0, 0, time.UTC), time.Date(2026, 3, 8, 0, 0, 0, 0, time.UTC)},
		{time.Date(2026, 3, 9, 4, 0, 0, 0, time.UTC), time.Date(2026, 3, 9, 0, 0, 0, 0, time.UTC)},
	}
	for _, testCase := range cases {
		if got := localdate.Of(testCase.instant, newYork); !got.Equal(testCase.want) {
			t.Errorf("Of(%s) = %s, want %s", testCase.instant, got, testCase.want)
		}
	}
}

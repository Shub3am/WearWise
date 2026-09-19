package anomaly_test

import (
	"testing"

	"github.com/Shub3am/WearWise/apps/ingest/internal/anomaly"
)

func TestDetect(t *testing.T) {
	cases := []struct {
		name          string
		previousZ     *float64
		currentZ      *float64
		wantDirection string
		wantFound     bool
	}{
		{"two high days", new(2.1), new(2.5), "high", true},
		{"two low days, threshold inclusive", new(-2.0), new(-3.0), "low", true},
		{"high then low", new(2.5), new(-2.5), "", false},
		{"one day below the threshold", new(1.9), new(3.0), "", false},
		{"no previous day", nil, new(3.0), "", false},
	}
	for _, testCase := range cases {
		direction, found := anomaly.Detect(testCase.previousZ, testCase.currentZ)
		if direction != testCase.wantDirection || found != testCase.wantFound {
			t.Errorf("%s: got (%q, %v), want (%q, %v)", testCase.name, direction, found, testCase.wantDirection, testCase.wantFound)
		}
	}
}

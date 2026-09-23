package dailyscore_test

import (
	"encoding/json"
	"testing"

	"github.com/Shub3am/WearWise/apps/ingest/internal/dailyscore"
)

func assertScore(t *testing.T, name string, got *int, want *int) {
	t.Helper()
	switch {
	case got == nil && want == nil:
	case got == nil || want == nil:
		t.Errorf("%s = %v, want %v", name, got, want)
	case *got != *want:
		t.Errorf("%s = %d, want %d", name, *got, *want)
	}
}

var fullSleep = dailyscore.SleepInputs{
	AsleepMinutes:        new(420.0),
	Efficiency:           new(0.9),
	DeepAndRemShare:      new(0.3),
	RecentBedtimeMinutes: []float64{600, 630, 570},
}

func TestScoreSleepWeighsEveryPart(t *testing.T) {
	// 87.5*0.4 + 100*0.2 + 50*0.2 + 72.78*0.2 = 79.56
	scores := dailyscore.Score(dailyscore.DayInputs{Sleep: fullSleep})
	assertScore(t, "Sleep", scores.Sleep, new(80))
}

func TestScoreSleepLeavesOutMissingParts(t *testing.T) {
	scores := dailyscore.Score(dailyscore.DayInputs{Sleep: dailyscore.SleepInputs{
		AsleepMinutes:        new(360.0),
		RecentBedtimeMinutes: []float64{600, 630},
	}})
	assertScore(t, "Sleep", scores.Sleep, new(75))
}

func TestScoreRecoveryIncludesTheSleepScore(t *testing.T) {
	// 75*0.35 + 60*0.25 + 50*0.1 + 80*0.3 = 70.25
	scores := dailyscore.Score(dailyscore.DayInputs{
		Sleep: fullSleep,
		Recovery: dailyscore.RecoveryInputs{
			HeartRateVariabilityZ: new(1.0),
			RestingHeartRateZ:     new(-0.4),
			RespiratoryRateZ:      new(-2.0),
		},
	})
	assertScore(t, "Recovery", scores.Recovery, new(70))
}

func TestScoreRecoveryClampsAHighRestingHeartRate(t *testing.T) {
	scores := dailyscore.Score(dailyscore.DayInputs{Recovery: dailyscore.RecoveryInputs{RestingHeartRateZ: new(3.0)}})
	assertScore(t, "Recovery", scores.Recovery, new(0))
}

func TestScoreRecoveryNeedsHeartRateVariabilityOrRestingHeartRate(t *testing.T) {
	scores := dailyscore.Score(dailyscore.DayInputs{
		Sleep:    fullSleep,
		Recovery: dailyscore.RecoveryInputs{RespiratoryRateZ: new(0.0)},
	})
	assertScore(t, "Recovery", scores.Recovery, nil)
}

func TestScoreActivityCapsEachPartAtItsGoal(t *testing.T) {
	// (75*0.4 + 100*0.3) / 0.7 = 85.71
	scores := dailyscore.Score(dailyscore.DayInputs{Activity: dailyscore.ActivityInputs{
		Steps:            new(6000.0),
		ActiveEnergyKcal: new(500.0),
	}})
	assertScore(t, "Activity", scores.Activity, new(86))
}

func TestScoreWithNoInputsHasNoScores(t *testing.T) {
	scores := dailyscore.Score(dailyscore.DayInputs{})
	assertScore(t, "Sleep", scores.Sleep, nil)
	assertScore(t, "Recovery", scores.Recovery, nil)
	assertScore(t, "Activity", scores.Activity, nil)
}

func TestDayInputsJSONLeavesOutMissingValues(t *testing.T) {
	encoded, err := json.Marshal(dailyscore.DayInputs{Activity: dailyscore.ActivityInputs{Steps: new(4000.0)}})
	if err != nil {
		t.Fatal(err)
	}
	want := `{"sleep":{},"recovery":{},"activity":{"steps":4000}}`
	if string(encoded) != want {
		t.Fatalf("got %s, want %s", encoded, want)
	}
}

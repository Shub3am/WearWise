// Why: turns one day's inputs into the sleep, recovery and activity scores, deterministically and versioned.
// Must not: read the database, compute baselines or call a model.
package dailyscore

import (
	"math"

	"github.com/Shub3am/WearWise/apps/ingest/internal/meanstddev"
)

// AlgorithmVersion is stored with every score row. Any change to a weight, goal or curve below needs a new version.
const AlgorithmVersion = 1

const (
	SleepGoalMinutes     = 480
	StepGoal             = 8000
	ActiveEnergyGoalKcal = 400
	ExerciseGoalMinutes  = 30
	// Bedtime consistency needs at least this many recent nights to mean anything.
	minimumBedtimes = 3
)

type SleepInputs struct {
	AsleepMinutes        *float64  `json:"asleepMinutes,omitempty"`
	Efficiency           *float64  `json:"efficiency,omitempty"`
	DeepAndRemShare      *float64  `json:"deepAndRemShare,omitempty"`
	RecentBedtimeMinutes []float64 `json:"recentBedtimeMinutes,omitempty"`
}

type RecoveryInputs struct {
	HeartRateVariabilityZ *float64 `json:"heartRateVariabilityZ,omitempty"`
	RestingHeartRateZ     *float64 `json:"restingHeartRateZ,omitempty"`
	RespiratoryRateZ      *float64 `json:"respiratoryRateZ,omitempty"`
}

type ActivityInputs struct {
	Steps            *float64 `json:"steps,omitempty"`
	ActiveEnergyKcal *float64 `json:"activeEnergyKcal,omitempty"`
	ExerciseMinutes  *float64 `json:"exerciseMinutes,omitempty"`
}

type DayInputs struct {
	Sleep    SleepInputs    `json:"sleep"`
	Recovery RecoveryInputs `json:"recovery"`
	Activity ActivityInputs `json:"activity"`
}

// DayScores holds 0 to 100 scores. A nil score means the day had too little data for it.
type DayScores struct {
	Sleep    *int
	Recovery *int
	Activity *int
}

type weightedPart struct {
	score  float64
	weight float64
}

func Score(inputs DayInputs) DayScores {
	sleepScore := scoreSleep(inputs.Sleep)
	return DayScores{
		Sleep:    sleepScore,
		Recovery: scoreRecovery(inputs.Recovery, sleepScore),
		Activity: scoreActivity(inputs.Activity),
	}
}

func scoreSleep(inputs SleepInputs) *int {
	if inputs.AsleepMinutes == nil {
		return nil
	}
	parts := []weightedPart{{scale(*inputs.AsleepMinutes, 0, SleepGoalMinutes), 0.4}}
	if inputs.Efficiency != nil {
		parts = append(parts, weightedPart{scale(*inputs.Efficiency, 0.65, 0.9), 0.2})
	}
	if inputs.DeepAndRemShare != nil {
		parts = append(parts, weightedPart{scale(*inputs.DeepAndRemShare, 0.2, 0.4), 0.2})
	}
	if len(inputs.RecentBedtimeMinutes) >= minimumBedtimes {
		_, bedtimeStddev := meanstddev.Population(inputs.RecentBedtimeMinutes)
		parts = append(parts, weightedPart{scale(bedtimeStddev, 90, 0), 0.2})
	}
	return weightedScore(parts)
}

// scoreRecovery needs heart rate variability or resting heart rate; respiratory rate and sleep alone say too little.
func scoreRecovery(inputs RecoveryInputs, sleepScore *int) *int {
	if inputs.HeartRateVariabilityZ == nil && inputs.RestingHeartRateZ == nil {
		return nil
	}
	var parts []weightedPart
	if inputs.HeartRateVariabilityZ != nil {
		parts = append(parts, weightedPart{scale(*inputs.HeartRateVariabilityZ, -2, 2), 0.35})
	}
	if inputs.RestingHeartRateZ != nil {
		parts = append(parts, weightedPart{scale(*inputs.RestingHeartRateZ, 2, -2), 0.25})
	}
	if inputs.RespiratoryRateZ != nil {
		parts = append(parts, weightedPart{scale(math.Abs(*inputs.RespiratoryRateZ), 4, 0), 0.1})
	}
	if sleepScore != nil {
		parts = append(parts, weightedPart{float64(*sleepScore), 0.3})
	}
	return weightedScore(parts)
}

func scoreActivity(inputs ActivityInputs) *int {
	var parts []weightedPart
	if inputs.Steps != nil {
		parts = append(parts, weightedPart{scale(*inputs.Steps, 0, StepGoal), 0.4})
	}
	if inputs.ActiveEnergyKcal != nil {
		parts = append(parts, weightedPart{scale(*inputs.ActiveEnergyKcal, 0, ActiveEnergyGoalKcal), 0.3})
	}
	if inputs.ExerciseMinutes != nil {
		parts = append(parts, weightedPart{scale(*inputs.ExerciseMinutes, 0, ExerciseGoalMinutes), 0.3})
	}
	return weightedScore(parts)
}

// weightedScore divides by the weights present, so a missing part is left out instead of counting as zero.
func weightedScore(parts []weightedPart) *int {
	if len(parts) == 0 {
		return nil
	}
	var weightedTotal, weightTotal float64
	for _, part := range parts {
		weightedTotal += part.score * part.weight
		weightTotal += part.weight
	}
	score := int(math.Round(weightedTotal / weightTotal))
	return &score
}

// scale maps value to 0 at zeroAt and 100 at fullAt, clamped. fullAt may be below zeroAt when less is better.
func scale(value, zeroAt, fullAt float64) float64 {
	return math.Min(math.Max((value-zeroAt)/(fullAt-zeroAt), 0), 1) * 100
}

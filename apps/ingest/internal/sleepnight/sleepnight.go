// Why: reduces stored sleep sessions to one night per local date, the unit the sleep score reads.
// Must not: score a night or read the database.
package sleepnight

import (
	"slices"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/localdate"
	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
)

type Session struct {
	StartAt time.Time
	EndAt   time.Time
	Stages  []samplebatch.SleepStage
}

type Night struct {
	LocalDate     time.Time
	AsleepMinutes float64
	// Efficiency and DeepAndRemShare are nil when the session has no stage that says the user was asleep.
	Efficiency      *float64
	DeepAndRemShare *float64
	// BedtimeMinute is minutes after local noon, so a 23:50 and a 00:10 bedtime sit 20 apart instead of 1420.
	BedtimeMinute float64
}

var asleepStages = []string{"asleep", "light", "deep", "rem"}
var stagedSleepStages = []string{"light", "deep", "rem"}
var deepAndRemStages = []string{"deep", "rem"}

// NightsByLocalDate dates each session by the local date it ended on. When two sessions end on the same date (a nap,
// or overlapping sessions from two sources), the one with more asleep time is the night.
func NightsByLocalDate(sessions []Session, location *time.Location) map[time.Time]Night {
	nights := make(map[time.Time]Night)
	for _, session := range sessions {
		night := nightOf(session, location)
		if existing, found := nights[night.LocalDate]; found && existing.AsleepMinutes >= night.AsleepMinutes {
			continue
		}
		nights[night.LocalDate] = night
	}
	return nights
}

func nightOf(session Session, location *time.Location) Night {
	spanMinutes := session.EndAt.Sub(session.StartAt).Minutes()
	localStart := session.StartAt.In(location)
	night := Night{
		LocalDate:     localdate.Of(session.EndAt, location),
		AsleepMinutes: spanMinutes,
		BedtimeMinute: float64((localStart.Hour()*60+localStart.Minute()+720)%1440) + float64(localStart.Second())/60,
	}
	asleepMinutes := unionMinutes(session.Stages, asleepStages)
	if asleepMinutes == 0 {
		return night
	}
	night.AsleepMinutes = asleepMinutes
	efficiency := asleepMinutes / spanMinutes
	night.Efficiency = &efficiency
	if unionMinutes(session.Stages, stagedSleepStages) > 0 {
		deepAndRemShare := unionMinutes(session.Stages, deepAndRemStages) / asleepMinutes
		night.DeepAndRemShare = &deepAndRemShare
	}
	return night
}

// unionMinutes counts each minute once even when stages from two sources overlap.
func unionMinutes(stages []samplebatch.SleepStage, stageNames []string) float64 {
	var matching []samplebatch.SleepStage
	for _, stage := range stages {
		if slices.Contains(stageNames, stage.Stage) {
			matching = append(matching, stage)
		}
	}
	slices.SortFunc(matching, func(left, right samplebatch.SleepStage) int { return left.StartAt.Compare(right.StartAt) })
	var total time.Duration
	var coveredUntil time.Time
	for _, stage := range matching {
		start := stage.StartAt
		if start.Before(coveredUntil) {
			start = coveredUntil
		}
		if stage.EndAt.After(start) {
			total += stage.EndAt.Sub(start)
			coveredUntil = stage.EndAt
		}
	}
	return total.Minutes()
}

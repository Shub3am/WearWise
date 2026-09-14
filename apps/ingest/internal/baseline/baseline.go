// Why: says what is normal for one user and one metric on one date, from the 28 days before it.
// Must not: read the database or decide what counts as an anomaly.
package baseline

import (
	"math"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/meanstddev"
)

const (
	WindowDays  = 28
	MinimumDays = 14
)

// StddevFloorByMetric keeps a very steady stretch from turning a normal wobble into a large z score. Only these
// metrics get baselines.
var StddevFloorByMetric = map[string]float64{
	"resting_heart_rate":         1,
	"heart_rate_variability":     3,
	"respiratory_rate":           0.5,
	"blood_oxygen_saturation":    0.5,
	"sleeping_wrist_temperature": 0.1,
}

type Baseline struct {
	Mean     float64
	Stddev   float64
	DayCount int
}

// Compute uses the days from localDate-28 through localDate-1, so a day is never compared with itself. It reports
// false when fewer than MinimumDays of those have a value.
func Compute(valueByLocalDate map[time.Time]float64, localDate time.Time, stddevFloor float64) (Baseline, bool) {
	var windowValues []float64
	for daysBack := 1; daysBack <= WindowDays; daysBack++ {
		if value, found := valueByLocalDate[localDate.AddDate(0, 0, -daysBack)]; found {
			windowValues = append(windowValues, value)
		}
	}
	if len(windowValues) < MinimumDays {
		return Baseline{}, false
	}
	mean, stddev := meanstddev.Population(windowValues)
	return Baseline{Mean: mean, Stddev: math.Max(stddev, stddevFloor), DayCount: len(windowValues)}, true
}

func (baseline Baseline) ZScore(value float64) float64 {
	return (value - baseline.Mean) / baseline.Stddev
}

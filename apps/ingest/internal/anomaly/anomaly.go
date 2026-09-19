// Why: decides whether a metric has been unusual for two days in a row.
// Must not: compute baselines or store anything.
package anomaly

const ZScoreThreshold = 2

// Detect needs both days at or beyond the threshold on the same side. A missing previous day is never an anomaly.
func Detect(previousZ, currentZ *float64) (direction string, found bool) {
	if previousZ == nil || currentZ == nil {
		return "", false
	}
	switch {
	case *previousZ >= ZScoreThreshold && *currentZ >= ZScoreThreshold:
		return "high", true
	case *previousZ <= -ZScoreThreshold && *currentZ <= -ZScoreThreshold:
		return "low", true
	}
	return "", false
}

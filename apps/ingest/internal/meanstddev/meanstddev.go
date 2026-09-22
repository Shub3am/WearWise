// Why: the one population mean and standard deviation that baselines and bedtime consistency share.
// Must not: apply floors, windows or any metric rule.
package meanstddev

import "math"

// Population returns the mean and the population standard deviation (divided by n, not n-1). values must not be empty.
func Population(values []float64) (mean, stddev float64) {
	var total float64
	for _, value := range values {
		total += value
	}
	mean = total / float64(len(values))
	var squaredDistance float64
	for _, value := range values {
		squaredDistance += (value - mean) * (value - mean)
	}
	return mean, math.Sqrt(squaredDistance / float64(len(values)))
}

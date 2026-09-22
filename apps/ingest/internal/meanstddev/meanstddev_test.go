package meanstddev_test

import (
	"testing"

	"github.com/Shub3am/WearWise/apps/ingest/internal/meanstddev"
)

func TestPopulationDividesByCount(t *testing.T) {
	mean, stddev := meanstddev.Population([]float64{2, 4, 4, 4, 5, 5, 7, 9})
	if mean != 5 || stddev != 2 {
		t.Fatalf("got mean %v stddev %v, want 5 and 2", mean, stddev)
	}
}

func TestPopulationOfOneValueHasNoSpread(t *testing.T) {
	mean, stddev := meanstddev.Population([]float64{61})
	if mean != 61 || stddev != 0 {
		t.Fatalf("got mean %v stddev %v, want 61 and 0", mean, stddev)
	}
}

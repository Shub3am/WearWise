package metriccatalog

import "testing"

func TestCanonicalUnitReturnsTheCatalogUnit(t *testing.T) {
	for metric, wantUnit := range map[string]string{
		"heart_rate":      "bpm",
		"physical_effort": "kcal/hr·kg",
		"step_count":      "count",
	} {
		unit, known := CanonicalUnit(metric)
		if !known || unit != wantUnit {
			t.Errorf("CanonicalUnit(%q) = %q, %v; want %q, true", metric, unit, known, wantUnit)
		}
	}
}

func TestCanonicalUnitRejectsUnknownMetric(t *testing.T) {
	if unit, known := CanonicalUnit("blood_glucose"); known {
		t.Fatalf("CanonicalUnit(blood_glucose) = %q, true; want unknown", unit)
	}
}

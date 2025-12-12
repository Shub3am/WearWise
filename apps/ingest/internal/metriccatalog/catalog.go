// Why: answers which unit ingest accepts for a metric, from the generated copy of the shared catalog.
// Must not: define metrics by hand; change packages/metrics-catalog and run `pnpm --filter @wearwise/ingest generate`.
package metriccatalog

//go:generate node generate-units.ts units.gen.go
//go:generate gofmt -w units.gen.go

func CanonicalUnit(metric string) (string, bool) {
	unit, known := canonicalUnits[metric]
	return unit, known
}

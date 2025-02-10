# metrics-catalog

Owns: the list of health metrics WearWise understands (id, label, canonical unit, category).

Must not know about: HealthKit / Health Connect identifiers, aggregation or scoring rules, storage.

Entry point: `src/index.ts` (`metricCatalog`, `isMetricId`, `MetricId`).

Invariants and gotchas:
- Ids are platform neutral snake_case and never change once shipped; they are stored in the database.
- Units are canonical. Platform units (the prototype export used kJ) are converted at sync time, not here.
- Heart rate variability differs by platform: Apple reports SDNN, Health Connect reports RMSSD. Same id, compare only against the same user's own baseline.
- Consumed as TypeScript source (no build). Import with the `.ts` extension inside the package.

Callers: apps/api, apps/worker, apps/mobile, and the Go ingest code generator (sub-project 2).

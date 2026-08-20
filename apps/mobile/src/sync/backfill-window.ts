// Why: one place for how far back a fresh sync reads, so the HealthKit and Health Connect backfills agree.
// Must not: know about either health store's query shape.
const backfillDays = 90;
const dayMillis = 24 * 60 * 60 * 1000;

export function backfillStartDate(): Date {
  return new Date(Date.now() - backfillDays * dayMillis);
}

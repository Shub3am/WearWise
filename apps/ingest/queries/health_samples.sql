-- name: EnsureHealthSamplesPartition :exec
SELECT ensure_health_samples_partition(sqlc.arg(sample_start_at)::timestamptz);

-- name: DropHealthSamplesPartitionsBefore :one
SELECT drop_health_samples_partitions_before(sqlc.arg(cutoff)::timestamptz)::integer AS dropped_count;

-- name: UpsertHealthSamples :execrows
INSERT INTO health_samples (user_id, metric, external_uuid, start_at, end_at, value, unit, source)
SELECT
  sqlc.arg(user_id)::uuid,
  unnest(sqlc.arg(metrics)::text[]),
  unnest(sqlc.arg(external_uuids)::text[]),
  unnest(sqlc.arg(start_ats)::timestamptz[]),
  unnest(sqlc.arg(end_ats)::timestamptz[]),
  unnest(sqlc.arg(sample_values)::double precision[]),
  unnest(sqlc.arg(units)::text[]),
  unnest(sqlc.arg(sources)::text[])
ON CONFLICT (user_id, metric, external_uuid, start_at) DO UPDATE
SET end_at = excluded.end_at, value = excluded.value, unit = excluded.unit, source = excluded.source
WHERE (health_samples.end_at, health_samples.value, health_samples.unit, health_samples.source)
  IS DISTINCT FROM (excluded.end_at, excluded.value, excluded.unit, excluded.source);

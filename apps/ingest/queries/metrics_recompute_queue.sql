-- name: MarkMetricsStale :exec
INSERT INTO metrics_recompute_queue (user_id, from_local_date)
SELECT users.id, (sqlc.arg(earliest_changed_at)::timestamptz AT TIME ZONE users.timezone)::date
FROM users
WHERE users.id = sqlc.arg(user_id)::uuid
ON CONFLICT (user_id) DO UPDATE
SET from_local_date = LEAST(metrics_recompute_queue.from_local_date, excluded.from_local_date),
  generation = metrics_recompute_queue.generation + 1,
  requested_at = now();

-- name: ListUsersDueForRecompute :many
SELECT user_id, from_local_date, generation
FROM metrics_recompute_queue
WHERE requested_at <= now() - make_interval(secs => sqlc.arg(settle_seconds)::integer)
ORDER BY requested_at
LIMIT sqlc.arg(user_limit)::integer;

-- name: TryLockUserMetrics :one
SELECT pg_try_advisory_xact_lock(hashtext('metrics_recompute'), hashtext(sqlc.arg(user_id)::uuid::text)) AS locked;

-- name: FindUserTimeZone :one
SELECT timezone FROM users WHERE id = sqlc.arg(user_id)::uuid FOR KEY SHARE;

-- name: FinishMetricsRecompute :exec
DELETE FROM metrics_recompute_queue
WHERE user_id = sqlc.arg(user_id)::uuid AND generation = sqlc.arg(generation)::bigint;

-- name: DeferMetricsRecompute :exec
UPDATE metrics_recompute_queue SET requested_at = now() WHERE user_id = sqlc.arg(user_id)::uuid;

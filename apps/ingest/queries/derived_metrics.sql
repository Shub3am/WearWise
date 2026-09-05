-- name: DeleteBaselines :exec
DELETE FROM baselines
WHERE user_id = sqlc.arg(user_id)::uuid
  AND local_date BETWEEN sqlc.arg(from_local_date)::date AND sqlc.arg(to_local_date)::date;

-- name: InsertBaselines :exec
INSERT INTO baselines (user_id, local_date, metric, mean, stddev, day_count)
SELECT sqlc.arg(user_id)::uuid, rows.local_date, rows.metric, rows.mean, rows.stddev, rows.day_count
FROM jsonb_to_recordset(sqlc.arg(baseline_rows)::jsonb)
  AS rows (local_date date, metric text, mean double precision, stddev double precision, day_count integer);

-- name: UpsertDailyScores :execrows
INSERT INTO daily_scores (user_id, local_date, sleep_score, recovery_score, activity_score, inputs, algorithm_version)
SELECT sqlc.arg(user_id)::uuid, rows.local_date, rows.sleep_score, rows.recovery_score, rows.activity_score,
  rows.inputs, sqlc.arg(algorithm_version)::integer
FROM jsonb_to_recordset(sqlc.arg(score_rows)::jsonb)
  AS rows (local_date date, sleep_score smallint, recovery_score smallint, activity_score smallint, inputs jsonb)
ON CONFLICT (user_id, local_date) DO UPDATE
SET sleep_score = excluded.sleep_score, recovery_score = excluded.recovery_score,
  activity_score = excluded.activity_score, inputs = excluded.inputs,
  algorithm_version = excluded.algorithm_version, computed_at = now()
WHERE (daily_scores.sleep_score, daily_scores.recovery_score, daily_scores.activity_score,
    daily_scores.inputs, daily_scores.algorithm_version)
  IS DISTINCT FROM (excluded.sleep_score, excluded.recovery_score, excluded.activity_score,
    excluded.inputs, excluded.algorithm_version);

-- name: InsertAnomalies :many
INSERT INTO anomalies (user_id, local_date, metric, z_score, direction)
SELECT sqlc.arg(user_id)::uuid, rows.local_date, rows.metric, rows.z_score, rows.direction
FROM jsonb_to_recordset(sqlc.arg(anomaly_rows)::jsonb)
  AS rows (local_date date, metric text, z_score double precision, direction text)
ON CONFLICT (user_id, local_date, metric) DO NOTHING
RETURNING id, local_date, metric, z_score, direction;

-- name: InsertOutboxEvent :exec
INSERT INTO outbox (user_id, topic, payload)
VALUES (sqlc.arg(user_id)::uuid, sqlc.arg(topic)::text, sqlc.arg(payload)::jsonb);

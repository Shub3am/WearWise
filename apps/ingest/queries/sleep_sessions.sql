-- name: UpsertSleepSessions :execrows
INSERT INTO sleep_sessions (user_id, external_uuid, start_at, end_at, source, stages)
SELECT
  sqlc.arg(user_id)::uuid,
  unnest(sqlc.arg(external_uuids)::text[]),
  unnest(sqlc.arg(start_ats)::timestamptz[]),
  unnest(sqlc.arg(end_ats)::timestamptz[]),
  unnest(sqlc.arg(sources)::text[]),
  unnest(sqlc.arg(stages)::jsonb[])
ON CONFLICT (user_id, external_uuid) DO UPDATE
SET start_at = excluded.start_at, end_at = excluded.end_at, source = excluded.source, stages = excluded.stages
WHERE (sleep_sessions.start_at, sleep_sessions.end_at, sleep_sessions.source, sleep_sessions.stages)
  IS DISTINCT FROM (excluded.start_at, excluded.end_at, excluded.source, excluded.stages);

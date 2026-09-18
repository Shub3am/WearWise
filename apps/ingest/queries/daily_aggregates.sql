-- name: DeleteDailyAggregates :exec
DELETE FROM daily_aggregates
WHERE user_id = sqlc.arg(user_id)::uuid
  AND local_date BETWEEN sqlc.arg(from_local_date)::date AND sqlc.arg(to_local_date)::date;

-- name: InsertDailyAggregates :execrows
WITH per_source AS (
  SELECT
    metric,
    (start_at AT TIME ZONE sqlc.arg(time_zone)::text)::date AS local_date,
    source,
    min(value) AS min_value,
    max(value) AS max_value,
    sum(value) AS sum_value,
    count(*) AS sample_count
  FROM health_samples
  WHERE user_id = sqlc.arg(user_id)::uuid
    AND start_at >= (sqlc.arg(from_local_date)::date::timestamp AT TIME ZONE sqlc.arg(time_zone)::text)
    AND start_at < ((sqlc.arg(to_local_date)::date + 1)::timestamp AT TIME ZONE sqlc.arg(time_zone)::text)
  GROUP BY metric, local_date, source
),
busiest_source AS (
  SELECT DISTINCT ON (metric, local_date) metric, local_date, min_value, max_value, sum_value, sample_count
  FROM per_source
  WHERE metric = ANY(sqlc.arg(cumulative_metrics)::text[])
  ORDER BY metric, local_date, sum_value DESC, source
),
every_source AS (
  SELECT metric, local_date, min(min_value) AS min_value, max(max_value) AS max_value,
    sum(sum_value) AS sum_value, sum(sample_count) AS sample_count
  FROM per_source
  WHERE NOT (metric = ANY(sqlc.arg(cumulative_metrics)::text[]))
  GROUP BY metric, local_date
)
INSERT INTO daily_aggregates (user_id, local_date, metric, min_value, avg_value, max_value, sum_value, sample_count)
SELECT sqlc.arg(user_id)::uuid, local_date, metric, min_value, sum_value / sample_count, max_value, sum_value, sample_count
FROM (SELECT * FROM busiest_source UNION ALL SELECT * FROM every_source) AS chosen;

-- name: ListDailyAggregates :many
SELECT local_date, metric, avg_value, sum_value
FROM daily_aggregates
WHERE user_id = sqlc.arg(user_id)::uuid
  AND local_date BETWEEN sqlc.arg(from_local_date)::date AND sqlc.arg(to_local_date)::date
  AND metric = ANY(sqlc.arg(metrics)::text[])
ORDER BY local_date, metric;

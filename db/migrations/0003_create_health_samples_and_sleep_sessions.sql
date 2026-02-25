-- migrate:up
CREATE TABLE health_samples (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  metric text NOT NULL,
  external_uuid text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL,
  source text NOT NULL,
  PRIMARY KEY (user_id, metric, external_uuid, start_at),
  CHECK (end_at >= start_at)
) PARTITION BY RANGE (start_at);

CREATE FUNCTION ensure_health_samples_partition(sample_start_at timestamptz) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  month_start timestamptz := date_trunc('month', sample_start_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  partition_name text := 'health_samples_' || to_char(month_start AT TIME ZONE 'UTC', 'YYYY_MM');
BEGIN
  IF to_regclass(partition_name) IS NOT NULL THEN
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('health_samples_partitions'));
  -- Creating the partition locks users for its foreign key after locking health_samples; a cascading
  -- user delete locks them in the opposite order. Locking users first makes the order match.
  LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF health_samples FOR VALUES FROM (%L) TO (%L)',
    partition_name, month_start, month_start + interval '1 month');
END;
$$;

CREATE FUNCTION drop_health_samples_partitions_before(cutoff timestamptz) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  partition_name text;
  dropped_count integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('health_samples_partitions'));
  FOR partition_name IN
    SELECT child.relname FROM pg_inherits
    JOIN pg_class child ON child.oid = pg_inherits.inhrelid
    WHERE pg_inherits.inhparent = 'health_samples'::regclass
  LOOP
    IF (to_date(right(partition_name, 7), 'YYYY_MM') + interval '1 month') AT TIME ZONE 'UTC' <= cutoff THEN
      EXECUTE format('DROP TABLE %I', partition_name);
      dropped_count := dropped_count + 1;
    END IF;
  END LOOP;
  RETURN dropped_count;
END;
$$;

CREATE TABLE sleep_sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  external_uuid text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  source text NOT NULL,
  stages jsonb NOT NULL,
  UNIQUE (user_id, external_uuid),
  CHECK (end_at > start_at)
);

-- migrate:down
DROP TABLE sleep_sessions;
DROP FUNCTION drop_health_samples_partitions_before(timestamptz);
DROP FUNCTION ensure_health_samples_partition(timestamptz);
DROP TABLE health_samples;

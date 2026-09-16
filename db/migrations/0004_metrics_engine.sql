-- migrate:up
CREATE TABLE metrics_recompute_queue (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  from_local_date date NOT NULL,
  generation bigint NOT NULL DEFAULT 1,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_aggregates (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  metric text NOT NULL,
  min_value double precision NOT NULL,
  avg_value double precision NOT NULL,
  max_value double precision NOT NULL,
  sum_value double precision NOT NULL,
  sample_count integer NOT NULL,
  PRIMARY KEY (user_id, local_date, metric)
);

CREATE TABLE baselines (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  metric text NOT NULL,
  mean double precision NOT NULL,
  stddev double precision NOT NULL,
  day_count integer NOT NULL,
  PRIMARY KEY (user_id, local_date, metric)
);

CREATE TABLE daily_scores (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  sleep_score smallint CHECK (sleep_score BETWEEN 0 AND 100),
  recovery_score smallint CHECK (recovery_score BETWEEN 0 AND 100),
  activity_score smallint CHECK (activity_score BETWEEN 0 AND 100),
  inputs jsonb NOT NULL,
  algorithm_version integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date)
);

CREATE TABLE anomalies (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  metric text NOT NULL,
  z_score double precision NOT NULL,
  direction text NOT NULL CHECK (direction IN ('high', 'low')),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date, metric)
);

CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (topic IN ('scores.updated', 'anomaly.detected')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE outbox;
DROP TABLE anomalies;
DROP TABLE daily_scores;
DROP TABLE baselines;
DROP TABLE daily_aggregates;
DROP TABLE metrics_recompute_queue;

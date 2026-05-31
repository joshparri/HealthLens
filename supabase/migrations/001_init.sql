-- Initial schema for HealthLens sync backend
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- health_sources
CREATE TABLE IF NOT EXISTS health_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text,
  type text,
  package_name text,
  device_name text,
  priority integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- health_sync_imports
CREATE TABLE IF NOT EXISTS health_sync_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  source text,
  sync_type text,
  started_at timestamptz,
  completed_at timestamptz,
  date_range_start date,
  date_range_end date,
  status text,
  record_count integer,
  warnings_json jsonb,
  app_version text,
  device_id_hash text
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_import_by_device_range ON health_sync_imports (user_id, device_id_hash, date_range_start, date_range_end);

-- daily_health_summary
CREATE TABLE IF NOT EXISTS daily_health_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date NOT NULL,
  timezone text,
  steps integer,
  distance_m numeric,
  active_minutes integer,
  active_zone_minutes integer,
  calories_total numeric,
  calories_active numeric,
  resting_hr numeric,
  hrv_rmssd numeric,
  respiratory_rate numeric,
  weight_kg numeric,
  body_fat_percent numeric,
  sleep_minutes integer,
  sleep_efficiency numeric,
  exercise_minutes integer,
  source_confidence numeric,
  sources_json jsonb,
  warnings_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  import_id uuid
);
CREATE INDEX IF NOT EXISTS idx_daily_by_user_date ON daily_health_summary (user_id, date);

-- sleep_sessions
CREATE TABLE IF NOT EXISTS sleep_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  timezone text,
  duration_minutes integer,
  asleep_minutes integer,
  awake_minutes integer,
  efficiency numeric,
  deep_minutes integer,
  rem_minutes integer,
  light_minutes integer,
  avg_sleep_hr numeric,
  avg_respiratory_rate numeric,
  source_id uuid,
  import_id uuid,
  raw_json jsonb
);

-- heart_metrics
CREATE TABLE IF NOT EXISTS heart_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  timestamp_or_date timestamptz,
  metric_type text,
  value numeric,
  unit text,
  source_id uuid,
  import_id uuid,
  raw_json jsonb
);

-- exercise_sessions
CREATE TABLE IF NOT EXISTS exercise_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  activity_type text,
  duration_minutes integer,
  distance_m numeric,
  calories numeric,
  steps integer,
  avg_hr numeric,
  max_hr numeric,
  source_id uuid,
  import_id uuid,
  raw_json jsonb
);

-- body_measurements
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  timestamp_or_date timestamptz,
  metric_type text,
  value numeric,
  unit text,
  source_id uuid,
  import_id uuid,
  raw_json jsonb
);

-- daily_context_tags
CREATE TABLE IF NOT EXISTS daily_context_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date,
  energy integer,
  stress integer,
  mood integer,
  sleep_quality integer,
  caffeine_amount numeric,
  caffeine_latest_time text,
  screen_minutes_after_9pm integer,
  relational_load integer,
  symptoms text,
  strength_training_done boolean,
  notes text,
  created_at timestamptz DEFAULT now()
);

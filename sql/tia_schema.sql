CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tia_position_status') THEN
    CREATE TYPE tia_position_status AS ENUM ('active', 'paused', 'closed', 'filled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tia_candidate_stage') THEN
    CREATE TYPE tia_candidate_stage AS ENUM ('sourcing', 'interview', 'eval', 'recommended', 'client_interview', 'offer', 'placed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tia_offer_risk') THEN
    CREATE TYPE tia_offer_risk AS ENUM ('none', 'counter_offer', 'competing_offer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tia_touch_type') THEN
    CREATE TYPE tia_touch_type AS ENUM ('cc_call', 'wechat', 'interview', 'client_feedback', 'stage_change', 'onboarding_checkin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tia_sentiment') THEN
    CREATE TYPE tia_sentiment AS ENUM ('positive', 'neutral', 'negative');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  status text NOT NULL DEFAULT 'active',
  contract_expires timestamptz,
  account_owner text,
  webhook_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_preferences (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  hard_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  off_limits text[] NOT NULL DEFAULT '{}',
  preferred_sources text[] NOT NULL DEFAULT '{}',
  salary_ceiling numeric,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  jd_raw text NOT NULL,
  jd_diagnosis jsonb NOT NULL DEFAULT '{}'::jsonb,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  status tia_position_status NOT NULL DEFAULT 'active',
  target_fee numeric,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  name text NOT NULL,
  mobile text,
  email text,
  current_company text,
  current_title text,
  years_experience integer,
  resume_text text,
  resume_path text,
  notes text,
  stage tia_candidate_stage NOT NULL DEFAULT 'sourcing',
  stage_updated_at timestamptz NOT NULL DEFAULT NOW(),
  ai_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  salary_current numeric,
  salary_expected numeric,
  offer_risk tia_offer_risk NOT NULL DEFAULT 'none',
  onboard_date date,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS touch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  touch_type tia_touch_type NOT NULL,
  summary text NOT NULL,
  sentiment tia_sentiment NOT NULL DEFAULT 'neutral',
  next_action text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_client_id ON positions(client_id);
CREATE INDEX IF NOT EXISTS idx_candidates_position_id ON candidates(position_id);
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(stage);
CREATE INDEX IF NOT EXISTS idx_candidates_stage_updated_at ON candidates(stage_updated_at);
CREATE INDEX IF NOT EXISTS idx_touch_records_candidate_id ON touch_records(candidate_id);
CREATE INDEX IF NOT EXISTS idx_touch_records_touch_type ON touch_records(touch_type);

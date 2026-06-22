import pool from './pool.js';
import { pathToFileURL } from 'url';

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_path TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  activation_token TEXT,
  activation_expires TIMESTAMPTZ,
  activation_last_sent_at TIMESTAMPTZ,
  activation_sent_count_24h INTEGER NOT NULL DEFAULT 0,
  activation_sent_window_start TIMESTAMPTZ,
  reset_token TEXT,
  reset_expires TIMESTAMPTZ,
  reset_last_sent_at TIMESTAMPTZ,
  reset_sent_count_24h INTEGER NOT NULL DEFAULT 0,
  reset_sent_window_start TIMESTAMPTZ,
  pending_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_token TEXT,
  ical_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ical_token TEXT,
  pending_email TEXT,
  email_change_token TEXT,
  email_change_expires TIMESTAMPTZ,
  email_change_last_sent_at TIMESTAMPTZ,
  email_change_sent_count_24h INTEGER NOT NULL DEFAULT 0,
  email_change_sent_window_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event info
  event_name        TEXT NOT NULL,
  race_date         DATE NOT NULL,
  flag_off_time     TEXT,
  cutoff_time       TEXT,
  route_file_path   TEXT,
  route_file_name   TEXT,
  location TEXT, city TEXT, country TEXT, website_url TEXT, instagram_url TEXT,
  timezone TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','dns','dnf','completed','upcoming')),

  -- Registration
  registration_datetime TIMESTAMP,
  registration_fee      NUMERIC(10,2),
  registration_currency TEXT DEFAULT 'USD',
  bib_number            TEXT,
  bib_name              TEXT,
  jersey_size           TEXT,
  registered_email      TEXT,
  registered_phone      TEXT,
  confirmation_number   TEXT,
  finish_time_target    TEXT,
  attachment_path       TEXT,
  attachment_name       TEXT,

  -- Distance & category
  distance_km    NUMERIC(10,3),
  distance_label TEXT,
  race_type      TEXT CHECK (race_type IN ('road','trail','track','virtual','other')),
  category       TEXT,
  elevation_gain_req_m INTEGER,
  itra_point     TEXT,

  -- Trail-specific
  itra_url       TEXT,
  qualification  TEXT,
  mandatory_items JSONB NOT NULL DEFAULT '[]',

  -- Results
  finish_time_seconds INTEGER, gun_time_seconds INTEGER, pace_per_km_seconds INTEGER,
  overall_place INTEGER, overall_total INTEGER,
  gender_place  INTEGER, gender_total  INTEGER,
  age_group_place INTEGER, age_group_total INTEGER, age_group_label TEXT,

  -- Vitals / conditions
  heart_rate_avg INTEGER, heart_rate_max INTEGER,
  actual_distance_km NUMERIC(10,3),
  elevation_gain_m INTEGER,
  weather_temp_c NUMERIC(4,1), weather_condition TEXT,

  -- Facility
  facilities JSONB NOT NULL DEFAULT '[]',

  -- Race Pack Collection
  rpc_date_start    DATE,
  rpc_date_end      DATE,
  rpc_time          TEXT,
  rpc_location      TEXT,
  rpc_status        TEXT NOT NULL DEFAULT 'not_collected',
  rpc_attachment_path TEXT,
  rpc_attachment_name TEXT,
  rpc_notes         TEXT,

  -- Notes
  notes TEXT, race_report TEXT,
  results_url TEXT, certificate_url TEXT,
  strava_url TEXT,
  result_file_path TEXT, result_file_name TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Email reminder
  registration_reminder_d1_sent_at TIMESTAMPTZ,
  registration_reminder_t1h_sent_at TIMESTAMPTZ,
  registration_reminder_d3_sent_at TIMESTAMPTZ,
  race_day_reminder_sent_at TIMESTAMPTZ,
  rpc_reminder_sent_at TIMESTAMPTZ,
  rpc_end_reminder_sent_at TIMESTAMPTZ,
  fill_rpc7_reminder_sent_at TIMESTAMPTZ,
  fill_rpc3_reminder_sent_at TIMESTAMPTZ,
  fill_results_reminder_sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS training_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        plan_date DATE NOT NULL,
        plan_time TEXT,
        race_id UUID REFERENCES races(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  transports TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS passkey_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration','authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_user ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_date  ON training_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_races_user_id  ON races(user_id);
CREATE INDEX IF NOT EXISTS idx_races_race_date ON races(race_date DESC);
CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup ON passkey_challenges(challenge, type);

ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_last_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_sent_count_24h INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_sent_window_start TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_last_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_sent_count_24h INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_sent_window_start TIMESTAMPTZ;
`;

async function migrate({ closePool = false } = {}) {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(schema);
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    if (closePool) {
      await pool.end();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate({ closePool: true }).catch(() => {
    process.exit(1);
  });
}

export default migrate;

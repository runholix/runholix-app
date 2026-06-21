import pool from './pool.js';

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  activation_token TEXT,
  activation_expires TIMESTAMPTZ,
  reset_token TEXT,
  reset_expires TIMESTAMPTZ,
  reset_last_sent_at TIMESTAMPTZ,
  reset_sent_count_24h INTEGER NOT NULL DEFAULT 0,
  reset_sent_window_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core event info
  event_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  location TEXT,
  city TEXT,
  country TEXT,
  website_url TEXT,

  -- Registration
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','dns','dnf','completed','upcoming')),
  registration_fee NUMERIC(10,2),
  registration_currency TEXT DEFAULT 'USD',
  registration_datetime TIMESTAMP,
  bib_number TEXT,
  confirmation_number TEXT,

  -- Distance
  distance_km NUMERIC(10,3),
  distance_label TEXT,
  race_type TEXT CHECK (race_type IN ('road','trail','track','virtual','other')),
  category TEXT,

  -- Results (post-race)
  finish_time_seconds INTEGER,
  gun_time_seconds INTEGER,
  pace_per_km_seconds INTEGER,
  overall_place INTEGER,
  overall_total INTEGER,
  gender_place INTEGER,
  gender_total INTEGER,
  age_group_place INTEGER,
  age_group_total INTEGER,
  age_group_label TEXT,

  -- Vitals
  heart_rate_avg INTEGER,
  heart_rate_max INTEGER,
  elevation_gain_m INTEGER,
  weather_temp_c NUMERIC(4,1),
  weather_condition TEXT,

  -- Notes
  notes TEXT,
  race_report TEXT,

  -- Tracking
  results_url TEXT,
  certificate_url TEXT,
  gpx_file_path TEXT,

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

CREATE TABLE IF NOT EXISTS race_gear (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT CHECK (category IN ('shoes','watch','clothing','other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_gear_used (
  race_id UUID REFERENCES races(id) ON DELETE CASCADE,
  gear_id UUID REFERENCES race_gear(id) ON DELETE CASCADE,
  PRIMARY KEY (race_id, gear_id)
);

CREATE INDEX IF NOT EXISTS idx_races_user_id ON races(user_id);
CREATE INDEX IF NOT EXISTS idx_races_race_date ON races(race_date DESC);
CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup ON passkey_challenges(challenge, type);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(schema);
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

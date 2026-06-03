import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import authRoutes from './routes/auth.js';
import racesRoutes from './routes/races.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: 'connected' }); }
  catch { res.status(503).json({ ok: false, db: 'disconnected' }); }
});

app.use('/api/auth', authRoutes);
app.use('/api/races', racesRoutes);
app.use('/api/upload', uploadRoutes);

async function startWithMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
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
        location TEXT, city TEXT, country TEXT, website_url TEXT,

        -- Status
        status TEXT NOT NULL DEFAULT 'registered'
          CHECK (status IN ('registered','dns','dnf','completed','upcoming')),

        -- Registration
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

        -- Results
        finish_time_seconds INTEGER, gun_time_seconds INTEGER, pace_per_km_seconds INTEGER,
        overall_place INTEGER, overall_total INTEGER,
        gender_place  INTEGER, gender_total  INTEGER,
        age_group_place INTEGER, age_group_total INTEGER, age_group_label TEXT,

        -- Vitals / conditions
        heart_rate_avg INTEGER, heart_rate_max INTEGER,
        elevation_gain_m INTEGER,
        weather_temp_c NUMERIC(4,1), weather_condition TEXT,

        -- Notes
        notes TEXT, race_report TEXT,
        results_url TEXT, certificate_url TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Idempotent additions for existing installs
      ALTER TABLE races ADD COLUMN IF NOT EXISTS flag_off_time      TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS cutoff_time        TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS route_file_path    TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS route_file_name    TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS bib_name           TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS jersey_size        TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS registered_email   TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS registered_phone   TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS finish_time_target TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS attachment_path    TEXT;
      ALTER TABLE races ADD COLUMN IF NOT EXISTS attachment_name    TEXT;

      CREATE INDEX IF NOT EXISTS idx_races_user_id  ON races(user_id);
      CREATE INDEX IF NOT EXISTS idx_races_race_date ON races(race_date DESC);
    `);
    console.log('Schema ready.');
  } finally { client.release(); }
}

startWithMigration()
  .then(() => app.listen(PORT, () => console.log(`API running on port ${PORT}`)))
  .catch(err => { console.error('Startup failed:', err); process.exit(1); });

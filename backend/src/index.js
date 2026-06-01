import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import authRoutes from './routes/auth.js';
import racesRoutes from './routes/races.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/races', racesRoutes);

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
        event_name TEXT NOT NULL,
        race_date DATE NOT NULL,
        location TEXT, city TEXT, country TEXT, website_url TEXT,
        status TEXT NOT NULL DEFAULT 'registered'
          CHECK (status IN ('registered','dns','dnf','completed','upcoming')),
        registration_fee NUMERIC(10,2),
        registration_currency TEXT DEFAULT 'USD',
        bib_number TEXT, confirmation_number TEXT,
        distance_km NUMERIC(10,3), distance_label TEXT,
        race_type TEXT CHECK (race_type IN ('road','trail','track','virtual','other')),
        category TEXT,
        finish_time_seconds INTEGER, gun_time_seconds INTEGER, pace_per_km_seconds INTEGER,
        overall_place INTEGER, overall_total INTEGER,
        gender_place INTEGER, gender_total INTEGER,
        age_group_place INTEGER, age_group_total INTEGER, age_group_label TEXT,
        heart_rate_avg INTEGER, heart_rate_max INTEGER,
        elevation_gain_m INTEGER, weather_temp_c NUMERIC(4,1), weather_condition TEXT,
        notes TEXT, race_report TEXT,
        results_url TEXT, certificate_url TEXT, gpx_file_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_races_user_id ON races(user_id);
      CREATE INDEX IF NOT EXISTS idx_races_race_date ON races(race_date DESC);
    `);
    console.log('Schema ready.');
  } finally {
    client.release();
  }
}

startWithMigration()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });

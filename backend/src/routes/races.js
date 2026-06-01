import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function formatSeconds(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

function parseTimeToSeconds(str) {
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function mapRace(row) {
  return {
    ...row,
    finish_time: formatSeconds(row.finish_time_seconds),
    gun_time: formatSeconds(row.gun_time_seconds),
    pace_per_km: formatSeconds(row.pace_per_km_seconds),
  };
}

router.get('/', async (req, res) => {
  const { status, year, search, sort = 'race_date', order = 'desc' } = req.query;
  let query = 'SELECT * FROM races WHERE user_id = $1';
  const params = [req.userId];
  let i = 2;

  if (status) { query += ` AND status = $${i++}`; params.push(status); }
  if (year) { query += ` AND EXTRACT(YEAR FROM race_date) = $${i++}`; params.push(year); }
  if (search) {
    query += ` AND (event_name ILIKE $${i} OR location ILIKE $${i} OR city ILIKE $${i})`;
    params.push(`%${search}%`); i++;
  }

  const safeSort = ['race_date', 'event_name', 'distance_km', 'finish_time_seconds', 'created_at'].includes(sort) ? sort : 'race_date';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${safeSort} ${safeOrder}`;

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows.map(mapRace));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
        COUNT(*) FILTER (WHERE status = 'registered' OR status = 'upcoming') AS upcoming_count,
        COALESCE(SUM(distance_km) FILTER (WHERE status = 'completed'), 0) AS total_distance_km,
        MIN(finish_time_seconds) FILTER (WHERE status = 'completed' AND distance_km BETWEEN 9.9 AND 10.2) AS best_10k,
        MIN(finish_time_seconds) FILTER (WHERE status = 'completed' AND distance_km BETWEEN 20.9 AND 21.2) AS best_half,
        MIN(finish_time_seconds) FILTER (WHERE status = 'completed' AND distance_km BETWEEN 41.9 AND 42.3) AS best_marathon
      FROM races WHERE user_id = $1
    `, [req.userId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM races WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const {
    event_name, race_date, location, city, country, website_url,
    status, registration_fee, registration_currency, bib_number, confirmation_number,
    distance_km, distance_label, race_type, category,
    finish_time, gun_time, overall_place, overall_total,
    gender_place, gender_total, age_group_place, age_group_total, age_group_label,
    heart_rate_avg, heart_rate_max, elevation_gain_m,
    weather_temp_c, weather_condition, notes, race_report, results_url, certificate_url
  } = req.body;

  if (!event_name || !race_date) return res.status(400).json({ error: 'event_name and race_date required' });

  try {
    const { rows } = await pool.query(`
      INSERT INTO races (
        user_id, event_name, race_date, location, city, country, website_url,
        status, registration_fee, registration_currency, bib_number, confirmation_number,
        distance_km, distance_label, race_type, category,
        finish_time_seconds, gun_time_seconds, overall_place, overall_total,
        gender_place, gender_total, age_group_place, age_group_total, age_group_label,
        heart_rate_avg, heart_rate_max, elevation_gain_m,
        weather_temp_c, weather_condition, notes, race_report, results_url, certificate_url
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
      ) RETURNING *`,
      [
        req.userId, event_name, race_date, location, city, country, website_url,
        status || 'registered', registration_fee, registration_currency || 'USD',
        bib_number, confirmation_number, distance_km, distance_label, race_type, category,
        parseTimeToSeconds(finish_time), parseTimeToSeconds(gun_time),
        overall_place, overall_total, gender_place, gender_total,
        age_group_place, age_group_total, age_group_label,
        heart_rate_avg, heart_rate_max, elevation_gain_m,
        weather_temp_c, weather_condition, notes, race_report, results_url, certificate_url
      ]
    );
    res.status(201).json(mapRace(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const {
    event_name, race_date, location, city, country, website_url,
    status, registration_fee, registration_currency, bib_number, confirmation_number,
    distance_km, distance_label, race_type, category,
    finish_time, gun_time, overall_place, overall_total,
    gender_place, gender_total, age_group_place, age_group_total, age_group_label,
    heart_rate_avg, heart_rate_max, elevation_gain_m,
    weather_temp_c, weather_condition, notes, race_report, results_url, certificate_url
  } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE races SET
        event_name=$1, race_date=$2, location=$3, city=$4, country=$5, website_url=$6,
        status=$7, registration_fee=$8, registration_currency=$9, bib_number=$10, confirmation_number=$11,
        distance_km=$12, distance_label=$13, race_type=$14, category=$15,
        finish_time_seconds=$16, gun_time_seconds=$17, overall_place=$18, overall_total=$19,
        gender_place=$20, gender_total=$21, age_group_place=$22, age_group_total=$23, age_group_label=$24,
        heart_rate_avg=$25, heart_rate_max=$26, elevation_gain_m=$27,
        weather_temp_c=$28, weather_condition=$29, notes=$30, race_report=$31,
        results_url=$32, certificate_url=$33, updated_at=NOW()
      WHERE id=$34 AND user_id=$35 RETURNING *`,
      [
        event_name, race_date, location, city, country, website_url,
        status, registration_fee, registration_currency, bib_number, confirmation_number,
        distance_km, distance_label, race_type, category,
        parseTimeToSeconds(finish_time), parseTimeToSeconds(gun_time),
        overall_place, overall_total, gender_place, gender_total,
        age_group_place, age_group_total, age_group_label,
        heart_rate_avg, heart_rate_max, elevation_gain_m,
        weather_temp_c, weather_condition, notes, race_report,
        results_url, certificate_url, req.params.id, req.userId
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM races WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

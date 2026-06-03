import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function str(v) {
  return (v === '' || v === undefined) ? null : v;
}
function jsonArr(v) {
  if (!v) return '[]';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
function formatSeconds(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}
function parseTimeToSeconds(t) {
  if (!t) return null;
  const parts = t.split(':').map(Number);
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
    facilities: Array.isArray(row.facilities) ? row.facilities : [],
  };
}

// ── LIST ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, year, search, sort = 'race_date', order = 'desc' } = req.query;
  let query = 'SELECT * FROM races WHERE user_id = $1';
  const params = [req.userId];
  let i = 2;
  if (status) { query += ` AND status = $${i++}`; params.push(status); }
  if (year)   { query += ` AND EXTRACT(YEAR FROM race_date) = $${i++}`; params.push(year); }
  if (search) {
    query += ` AND (event_name ILIKE $${i} OR location ILIKE $${i} OR city ILIKE $${i})`;
    params.push(`%${search}%`); i++;
  }
  const safeSort  = ['race_date','event_name','distance_km','finish_time_seconds','created_at'].includes(sort) ? sort : 'race_date';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${safeSort} ${safeOrder}`;
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows.map(mapRace));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── STATS ─────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='completed') AS total_completed,
        COUNT(*) FILTER (WHERE status IN ('registered','upcoming')) AS upcoming_count,
        COALESCE(SUM(distance_km) FILTER (WHERE status='completed'),0) AS total_distance_km,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 9.9 AND 10.2)   AS best_10k,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 20.9 AND 21.2)  AS best_half,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 41.9 AND 42.3)  AS best_marathon
      FROM races WHERE user_id = $1`, [req.userId]);
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM races WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── CREATE ────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const b = req.body;
  if (!b.event_name || !b.race_date) return res.status(400).json({ error: 'event_name and race_date required' });
  if (!b.cutoff_time) return res.status(400).json({ error: 'cutoff_time required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO races (
        user_id, event_name, race_date, flag_off_time, cutoff_time,
        route_file_path, route_file_name,
        location, city, country, website_url, status,
        registration_fee, registration_currency,
        bib_number, bib_name, jersey_size,
        registered_email, registered_phone,
        confirmation_number, finish_time_target,
        attachment_path, attachment_name,
        distance_km, distance_label, race_type, category,
        finish_time_seconds, gun_time_seconds,
        overall_place, overall_total, gender_place, gender_total,
        age_group_place, age_group_total, age_group_label,
        heart_rate_avg, heart_rate_max, elevation_gain_m,
        weather_temp_c, weather_condition, notes, race_report,
        results_url, certificate_url, facilities,
        rpc_date_start, rpc_date_end, rpc_time, rpc_location, rpc_status,
        rpc_attachment_path, rpc_attachment_name, rpc_notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,
        $45,$46,$47,$48,$49,$50,$51,$52
      ) RETURNING *`,
      [
        req.userId, b.event_name, b.race_date,
        str(b.flag_off_time), b.cutoff_time,
        str(b.route_file_path), str(b.route_file_name),
        str(b.location), str(b.city), str(b.country), str(b.website_url),
        b.status || 'registered',
        num(b.registration_fee), b.registration_currency || 'USD',
        str(b.bib_number), str(b.bib_name), str(b.jersey_size),
        str(b.registered_email), str(b.registered_phone),
        str(b.confirmation_number), str(b.finish_time_target),
        str(b.attachment_path), str(b.attachment_name),
        num(b.distance_km), str(b.distance_label), str(b.race_type), str(b.category),
        parseTimeToSeconds(b.finish_time), parseTimeToSeconds(b.gun_time),
        num(b.overall_place), num(b.overall_total),
        num(b.gender_place), num(b.gender_total),
        num(b.age_group_place), num(b.age_group_total), str(b.age_group_label),
        num(b.heart_rate_avg), num(b.heart_rate_max), num(b.elevation_gain_m),
        num(b.weather_temp_c), str(b.weather_condition),
        str(b.notes), str(b.race_report), str(b.results_url), str(b.certificate_url),
        jsonArr(b.facilities),
        str(b.rpc_date_start), str(b.rpc_date_end),
        str(b.rpc_time), str(b.rpc_location),
        b.rpc_status || 'not_collected',
        str(b.rpc_attachment_path), str(b.rpc_attachment_name), str(b.rpc_notes),
      ]
    );
    res.status(201).json(mapRace(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── UPDATE ────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const b = req.body;
  if (!b.cutoff_time) return res.status(400).json({ error: 'cutoff_time required' });
  try {
    const { rows } = await pool.query(`
      UPDATE races SET
        event_name=$1, race_date=$2, flag_off_time=$3, cutoff_time=$4,
        route_file_path=$5, route_file_name=$6,
        location=$7, city=$8, country=$9, website_url=$10, status=$11,
        registration_fee=$12, registration_currency=$13,
        bib_number=$14, bib_name=$15, jersey_size=$16,
        registered_email=$17, registered_phone=$18,
        confirmation_number=$19, finish_time_target=$20,
        attachment_path=$21, attachment_name=$22,
        distance_km=$23, distance_label=$24, race_type=$25, category=$26,
        finish_time_seconds=$27, gun_time_seconds=$28,
        overall_place=$29, overall_total=$30, gender_place=$31, gender_total=$32,
        age_group_place=$33, age_group_total=$34, age_group_label=$35,
        heart_rate_avg=$36, heart_rate_max=$37, elevation_gain_m=$38,
        weather_temp_c=$39, weather_condition=$40, notes=$41, race_report=$42,
        results_url=$43, certificate_url=$44, facilities=$45,
        rpc_date_start=$46, rpc_date_end=$47, rpc_time=$48, rpc_location=$49, rpc_status=$50,
        rpc_attachment_path=$51, rpc_attachment_name=$52, rpc_notes=$53,
        updated_at=NOW()
      WHERE id=$54 AND user_id=$55 RETURNING *`,
      [
        b.event_name, b.race_date,
        str(b.flag_off_time), b.cutoff_time,
        str(b.route_file_path), str(b.route_file_name),
        str(b.location), str(b.city), str(b.country), str(b.website_url),
        b.status,
        num(b.registration_fee), b.registration_currency || 'USD',
        str(b.bib_number), str(b.bib_name), str(b.jersey_size),
        str(b.registered_email), str(b.registered_phone),
        str(b.confirmation_number), str(b.finish_time_target),
        str(b.attachment_path), str(b.attachment_name),
        num(b.distance_km), str(b.distance_label), str(b.race_type), str(b.category),
        parseTimeToSeconds(b.finish_time), parseTimeToSeconds(b.gun_time),
        num(b.overall_place), num(b.overall_total),
        num(b.gender_place), num(b.gender_total),
        num(b.age_group_place), num(b.age_group_total), str(b.age_group_label),
        num(b.heart_rate_avg), num(b.heart_rate_max), num(b.elevation_gain_m),
        num(b.weather_temp_c), str(b.weather_condition),
        str(b.notes), str(b.race_report), str(b.results_url), str(b.certificate_url),
        jsonArr(b.facilities),
        str(b.rpc_date_start), str(b.rpc_date_end),
        str(b.rpc_time), str(b.rpc_location),
        b.rpc_status || 'not_collected',
        str(b.rpc_attachment_path), str(b.rpc_attachment_name), str(b.rpc_notes),
        req.params.id, req.userId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM races WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;

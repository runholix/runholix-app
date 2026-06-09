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
    mandatory_items: Array.isArray(row.mandatory_items) ? row.mandatory_items : [],
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
        COALESCE(SUM(elevation_gain_m) FILTER (WHERE status='completed'),0) AS total_elevation_m,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 4.9 AND 5.2)   AS best_5k,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 9.9 AND 10.2)  AS best_10k,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 20.9 AND 21.2) AS best_half,
        MIN(finish_time_seconds) FILTER (WHERE status='completed' AND distance_km BETWEEN 41.9 AND 42.3) AS best_marathon
      FROM races WHERE user_id = $1`, [req.userId]);
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM races WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── CREATE ────────────────────────────────────────────────────────────────
// 63 columns → $1..$63
router.post('/', async (req, res) => {
  const b = req.body;
  if (!b.event_name || !b.race_date) return res.status(400).json({ error: 'event_name and race_date required' });
  if (!b.cutoff_time) return res.status(400).json({ error: 'cutoff_time required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO races (
        user_id,              -- $1
        event_name,           -- $2
        race_date,            -- $3
        flag_off_time,        -- $4
        cutoff_time,          -- $5
        route_file_path,      -- $6
        route_file_name,      -- $7
        location,             -- $8
        city,                 -- $9
        country,              -- $10
        website_url,          -- $11
        instagram_url,        -- $12
        status,               -- $13
        registration_fee,     -- $14
        registration_currency,-- $15
        bib_number,           -- $16
        bib_name,             -- $17
        jersey_size,          -- $18
        registered_email,     -- $19
        registered_phone,     -- $20
        confirmation_number,  -- $21
        finish_time_target,   -- $22
        attachment_path,      -- $23
        attachment_name,      -- $24
        distance_km,          -- $25
        distance_label,       -- $26
        race_type,            -- $27
        category,             -- $28
        elevation_gain_req_m, -- $29
        itra_point,           -- $30
        itra_url,             -- $31
        qualification,        -- $32
        finish_time_seconds,  -- $33
        gun_time_seconds,     -- $34
        overall_place,        -- $35
        overall_total,        -- $36
        gender_place,         -- $37
        gender_total,         -- $38
        age_group_place,      -- $39
        age_group_total,      -- $40
        age_group_label,      -- $41
        heart_rate_avg,       -- $42
        heart_rate_max,       -- $43
        actual_distance_km,   -- $44
        elevation_gain_m,     -- $45
        weather_temp_c,       -- $46
        weather_condition,    -- $47
        notes,                -- $48
        race_report,          -- $49
        results_url,          -- $50
        certificate_url,      -- $51
        facilities,           -- $52
        rpc_date_start,       -- $53
        rpc_date_end,         -- $54
        rpc_time,             -- $55
        rpc_location,         -- $56
        rpc_status,           -- $57
        rpc_attachment_path,  -- $58
        rpc_attachment_name,  -- $59
        rpc_notes,            -- $60
        mandatory_items,      -- $61
        strava_url,           -- $62
        result_file_path,     -- $63
        result_file_name      -- $64
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,
        $43,$44,$45,$46,$47,$48,$49,$50,$51,$52,
        $53,$54,$55,$56,$57,$58,$59,$60,$61,$62,
        $63,$64
      ) RETURNING *`,
      [
        req.userId,                          // $1
        b.event_name,                        // $2
        b.race_date,                         // $3
        str(b.flag_off_time),               // $4
        b.cutoff_time,                       // $5
        str(b.route_file_path),             // $6
        str(b.route_file_name),             // $7
        str(b.location),                    // $8
        str(b.city),                        // $9
        str(b.country),                     // $10
        str(b.website_url),                 // $11
        str(b.instagram_url),               // $12
        b.status || 'registered',           // $13
        num(b.registration_fee),            // $14
        b.registration_currency || 'USD',   // $15
        str(b.bib_number),                  // $16
        str(b.bib_name),                    // $17
        str(b.jersey_size),                 // $18
        str(b.registered_email),            // $19
        str(b.registered_phone),            // $20
        str(b.confirmation_number),         // $21
        str(b.finish_time_target),          // $22
        str(b.attachment_path),             // $23
        str(b.attachment_name),             // $24
        num(b.distance_km),                 // $25
        str(b.distance_label),              // $26
        str(b.race_type),                   // $27
        str(b.category),                    // $28
        num(b.elevation_gain_req_m),        // $29
        str(b.itra_point),                  // $30
        str(b.itra_url),                    // $31
        str(b.qualification),               // $32
        parseTimeToSeconds(b.finish_time),  // $33
        parseTimeToSeconds(b.gun_time),     // $34
        num(b.overall_place),               // $35
        num(b.overall_total),               // $36
        num(b.gender_place),                // $37
        num(b.gender_total),                // $38
        num(b.age_group_place),             // $39
        num(b.age_group_total),             // $40
        str(b.age_group_label),             // $41
        num(b.heart_rate_avg),              // $42
        num(b.heart_rate_max),              // $43
        num(b.actual_distance_km),          // $44
        num(b.elevation_gain_m),            // $45
        num(b.weather_temp_c),              // $46
        str(b.weather_condition),           // $47
        str(b.notes),                       // $48
        str(b.race_report),                 // $49
        str(b.results_url),                 // $50
        str(b.certificate_url),             // $51
        jsonArr(b.facilities),              // $52
        str(b.rpc_date_start),              // $53
        str(b.rpc_date_end),                // $54
        str(b.rpc_time),                    // $55
        str(b.rpc_location),                // $56
        b.rpc_status || 'not_collected',    // $57
        str(b.rpc_attachment_path),         // $58
        str(b.rpc_attachment_name),         // $59
        str(b.rpc_notes),                   // $60
        jsonArr(b.mandatory_items),         // $61
        str(b.strava_url),                  // $62
        str(b.result_file_path),            // $63
        str(b.result_file_name),            // $64
      ]
    );
    res.status(201).json(mapRace(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── UPDATE ────────────────────────────────────────────────────────────────
// 62 SET columns $1..$62, then id=$63 user_id=$64
router.put('/:id', async (req, res) => {
  const b = req.body;
  if (!b.cutoff_time) return res.status(400).json({ error: 'cutoff_time required' });
  try {
    const { rows } = await pool.query(`
      UPDATE races SET
        event_name=$1,           race_date=$2,
        flag_off_time=$3,        cutoff_time=$4,
        route_file_path=$5,      route_file_name=$6,
        location=$7,             city=$8,
        country=$9,              website_url=$10,
        instagram_url=$11,       status=$12,
        registration_fee=$13,    registration_currency=$14,
        bib_number=$15,          bib_name=$16,
        jersey_size=$17,
        registered_email=$18,    registered_phone=$19,
        confirmation_number=$20, finish_time_target=$21,
        attachment_path=$22,     attachment_name=$23,
        distance_km=$24,         distance_label=$25,
        race_type=$26,           category=$27,
        elevation_gain_req_m=$28, itra_point=$29,
        itra_url=$30,            qualification=$31,
        finish_time_seconds=$32, gun_time_seconds=$33,
        overall_place=$34,       overall_total=$35,
        gender_place=$36,        gender_total=$37,
        age_group_place=$38,     age_group_total=$39,
        age_group_label=$40,
        heart_rate_avg=$41,      heart_rate_max=$42,
        actual_distance_km=$43,  elevation_gain_m=$44,
        weather_temp_c=$45,      weather_condition=$46,
        notes=$47,               race_report=$48,
        results_url=$49,         certificate_url=$50,
        facilities=$51,
        rpc_date_start=$52,      rpc_date_end=$53,
        rpc_time=$54,            rpc_location=$55,
        rpc_status=$56,
        rpc_attachment_path=$57, rpc_attachment_name=$58,
        rpc_notes=$59,
        mandatory_items=$60,
        strava_url=$61,
        result_file_path=$62,    result_file_name=$63,
        updated_at=NOW()
      WHERE id=$64 AND user_id=$65 RETURNING *`,
      [
        b.event_name,                        // $1
        b.race_date,                         // $2
        str(b.flag_off_time),               // $3
        b.cutoff_time,                       // $4
        str(b.route_file_path),             // $5
        str(b.route_file_name),             // $6
        str(b.location),                    // $7
        str(b.city),                        // $8
        str(b.country),                     // $9
        str(b.website_url),                 // $10
        str(b.instagram_url),               // $11
        b.status,                           // $12
        num(b.registration_fee),            // $13
        b.registration_currency || 'USD',   // $14
        str(b.bib_number),                  // $15
        str(b.bib_name),                    // $16
        str(b.jersey_size),                 // $17
        str(b.registered_email),            // $18
        str(b.registered_phone),            // $19
        str(b.confirmation_number),         // $20
        str(b.finish_time_target),          // $21
        str(b.attachment_path),             // $22
        str(b.attachment_name),             // $23
        num(b.distance_km),                 // $24
        str(b.distance_label),              // $25
        str(b.race_type),                   // $26
        str(b.category),                    // $27
        num(b.elevation_gain_req_m),        // $28
        str(b.itra_point),                  // $29
        str(b.itra_url),                    // $30
        str(b.qualification),               // $31
        parseTimeToSeconds(b.finish_time),  // $32
        parseTimeToSeconds(b.gun_time),     // $33
        num(b.overall_place),               // $34
        num(b.overall_total),               // $35
        num(b.gender_place),                // $36
        num(b.gender_total),                // $37
        num(b.age_group_place),             // $38
        num(b.age_group_total),             // $39
        str(b.age_group_label),             // $40
        num(b.heart_rate_avg),              // $41
        num(b.heart_rate_max),              // $42
        num(b.actual_distance_km),          // $43
        num(b.elevation_gain_m),            // $44
        num(b.weather_temp_c),              // $45
        str(b.weather_condition),           // $46
        str(b.notes),                       // $47
        str(b.race_report),                 // $48
        str(b.results_url),                 // $49
        str(b.certificate_url),             // $50
        jsonArr(b.facilities),              // $51
        str(b.rpc_date_start),              // $52
        str(b.rpc_date_end),                // $53
        str(b.rpc_time),                    // $54
        str(b.rpc_location),                // $55
        b.rpc_status || 'not_collected',    // $56
        str(b.rpc_attachment_path),         // $57
        str(b.rpc_attachment_name),         // $58
        str(b.rpc_notes),                   // $59
        jsonArr(b.mandatory_items),         // $60
        str(b.strava_url),                  // $61
        str(b.result_file_path),            // $62
        str(b.result_file_name),            // $63
        req.params.id,                      // $64
        req.userId,                         // $65
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM races WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;

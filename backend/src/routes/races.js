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
function registrationDateTime(b) {
  return b.status === 'upcoming' ? str(b.registration_datetime) : null;
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

router.get('/calendar', async (req, res) => {
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year required' });

  try {
    const { rows } = await pool.query(
      `
        SELECT
          r.id,
          r.event_name,
          r.race_date::text AS race_date,
          r.status,
          r.flag_off_time,
          r.registration_datetime::text AS registration_datetime,
          r.rpc_date_start::text AS rpc_date_start,
          r.rpc_date_end::text AS rpc_date_end,
          r.rpc_time,
          r.rpc_location,
          r.rpc_status
        FROM races r
        WHERE r.user_id = $1
          AND EXTRACT(YEAR FROM r.race_date) = $2
        ORDER BY r.race_date, r.created_at
      `,
      [req.userId, year]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
router.get('/dashboard', async (req, res) => {
  try {
    const baseSql = `
      FROM races r
      WHERE r.user_id = $1
    `;

    const [upcomingRows, recentRows, yearlyRows] = await Promise.all([
      pool.query(
        `
          SELECT
            r.id,
            r.event_name,
            r.race_date::text AS race_date,
            r.city,
            r.location,
            r.bib_number,
            r.distance_label
          ${baseSql}
          AND r.status IN ('registered','upcoming')
          ORDER BY r.race_date ASC, r.created_at DESC
          LIMIT 5
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT
            r.id,
            r.event_name,
            r.race_date::text AS race_date,
            r.distance_label,
            r.distance_km,
            r.finish_time_seconds,
            r.overall_place,
            r.overall_total
          ${baseSql}
          AND r.status = 'completed'
          ORDER BY r.race_date DESC, r.created_at DESC
          LIMIT 5
        `,
        [req.userId]
      ),
      pool.query(
        `
          SELECT
            EXTRACT(YEAR FROM r.race_date)::int AS year,
            COUNT(*)::int AS count,
            COALESCE(SUM(r.distance_km) FILTER (WHERE r.status = 'completed'), 0) AS total_distance_km,
            COALESCE(SUM(r.elevation_gain_m) FILTER (WHERE r.status = 'completed'), 0) AS total_elevation_m
          ${baseSql}
          GROUP BY 1
          ORDER BY year DESC
        `,
        [req.userId]
      ),
    ]);

    res.json({
      upcoming: upcomingRows.rows.map(mapRace),
      recent: recentRows.rows.map(mapRace),
      yearlyCounts: yearlyRows.rows.map(r => ({
        year: String(r.year),
        count: r.count,
        total_distance_km: Number(r.total_distance_km || 0),
        total_elevation_m: Number(r.total_elevation_m || 0),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── LIST ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, year, search, sort = 'race_date', order = 'desc', page = '1', pageSize = '10' } = req.query;
  const limit = Math.max(1, Math.min(100, Number(pageSize) || 10));
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * limit;
  let where = ' FROM races r WHERE r.user_id = $1';
  const params = [req.userId];
  let i = 2;
  if (status) { where += ` AND r.status = $${i++}`; params.push(status); }
  if (year)   { where += ` AND EXTRACT(YEAR FROM r.race_date) = $${i++}`; params.push(year); }
  if (search) {
    where += ` AND (r.event_name ILIKE $${i} OR r.location ILIKE $${i} OR r.city ILIKE $${i})`;
    params.push(`%${search}%`); i++;
  }
  const safeSort  = ['r.race_date','r.event_name','r.distance_km','r.finish_time_seconds','r.created_at'].includes(sort) ? sort : 'r.race_date';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
  const countSql = `SELECT COUNT(*)::int AS total${where}`;
  const dataSql = `SELECT r.*, r.race_date::text AS race_date, r.registration_datetime::text AS registration_datetime, r.rpc_date_start::text AS rpc_date_start, r.rpc_date_end::text AS rpc_date_end${where} ORDER BY ${safeSort} ${safeOrder} LIMIT $${i} OFFSET $${i + 1}`;
  const yearsSql = `SELECT DISTINCT EXTRACT(YEAR FROM r.race_date)::int AS year${where} ORDER BY year DESC`;
  try {
    const { rows: countRows } = await pool.query(countSql, params);
    const { rows } = await pool.query(dataSql, [...params, limit, offset]);
    const { rows: yearRows } = await pool.query(yearsSql, params);
    const total = countRows[0]?.total || 0;
    res.json({
      items: rows.map(mapRace),
      total,
      page: currentPage,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      years: yearRows.map(r => String(r.year)).filter(Boolean),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── STATS ─────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH base AS (
        SELECT *
        FROM races
        WHERE user_id = $1
      ),
      bests AS (
        SELECT 'best_5k' AS key, id, finish_time_seconds, race_date
        FROM base
        WHERE status = 'completed' AND distance_km BETWEEN 4.9 AND 5.9 AND finish_time_seconds IS NOT NULL
        UNION ALL
        SELECT 'best_10k' AS key, id, finish_time_seconds, race_date
        FROM base
        WHERE status = 'completed' AND distance_km BETWEEN 9.9 AND 10.9 AND finish_time_seconds IS NOT NULL
        UNION ALL
        SELECT 'best_half' AS key, id, finish_time_seconds, race_date
        FROM base
        WHERE status = 'completed' AND distance_km BETWEEN 20.9 AND 22.9 AND finish_time_seconds IS NOT NULL
        UNION ALL
        SELECT 'best_marathon' AS key, id, finish_time_seconds, race_date
        FROM base
        WHERE status = 'completed' AND distance_km BETWEEN 41.9 AND 43.9 AND finish_time_seconds IS NOT NULL
      ),
      ranked AS (
        SELECT
          key,
          id,
          finish_time_seconds,
          race_date,
          ROW_NUMBER() OVER (PARTITION BY key ORDER BY finish_time_seconds ASC, race_date ASC, id ASC) AS rn
        FROM bests
      ),
      all_time AS (
        SELECT
          MAX(finish_time_seconds) FILTER (WHERE key='best_5k' AND rn=1) AS unused
        FROM ranked
      ),
      all_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE status='completed') AS total_completed,
          COUNT(*) FILTER (WHERE status IN ('registered','upcoming')) AS upcoming_count,
          COALESCE(SUM(distance_km) FILTER (WHERE status='completed'),0) AS total_distance_km,
          COALESCE(SUM(elevation_gain_m) FILTER (WHERE status='completed'),0) AS total_elevation_m
        FROM base
      ),
      best_all_time AS (
        SELECT jsonb_object_agg(key, jsonb_build_object('race_id', id, 'finish_time_seconds', finish_time_seconds)) AS data
        FROM ranked
        WHERE rn = 1
      ),
      best_last_year AS (
        SELECT jsonb_object_agg(key, jsonb_build_object('race_id', id, 'finish_time_seconds', finish_time_seconds)) AS data
        FROM (
          SELECT key, id, finish_time_seconds
          FROM (
            SELECT
              key,
              id,
              finish_time_seconds,
              race_date,
              ROW_NUMBER() OVER (PARTITION BY key ORDER BY finish_time_seconds ASC, race_date ASC, id ASC) AS rn
            FROM bests
            WHERE race_date >= CURRENT_DATE - INTERVAL '1 year'
          ) x
          WHERE rn = 1
        ) y
      )
      SELECT
        s.total_completed,
        s.upcoming_count,
        s.total_distance_km,
        s.total_elevation_m,
        COALESCE(a.data, '{}'::jsonb) AS best_all_time,
        COALESCE(l.data, '{}'::jsonb) AS best_last_year
      FROM all_stats s
      CROSS JOIN best_all_time a
      CROSS JOIN best_last_year l
    `, [req.userId]);
    const row = rows[0] || {};
    res.json({
      ...row,
      personal_bests: {
        all_time: row.best_all_time || {},
        last_year: row.best_last_year || {},
      },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT *, race_date::text AS race_date, registration_datetime::text AS registration_datetime, rpc_date_start::text AS rpc_date_start, rpc_date_end::text AS rpc_date_end FROM races WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRace(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── CREATE ────────────────────────────────────────────────────────────────
// 64 columns → $1..$64
router.post('/', async (req, res) => {
  const b = req.body;
  if (!b.event_name || !b.race_date) return res.status(400).json({ error: 'event_name and race_date required' });
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
        timezone,             -- $13
        status,               -- $14
        registration_fee,     -- $15
        registration_currency,-- $16
        bib_number,           -- $17
        bib_name,             -- $18
        jersey_size,          -- $19
        registered_email,     -- $20
        registered_phone,     -- $21
        confirmation_number,  -- $22
        finish_time_target,   -- $23
        attachment_path,      -- $24
        attachment_name,      -- $25
        distance_km,          -- $26
        distance_label,       -- $27
        race_type,            -- $28
        category,             -- $29
        elevation_gain_req_m, -- $30
        itra_point,           -- $31
        itra_url,             -- $32
        qualification,        -- $33
        finish_time_seconds,  -- $34
        gun_time_seconds,     -- $35
        overall_place,        -- $36
        overall_total,        -- $37
        gender_place,         -- $38
        gender_total,         -- $39
        age_group_place,      -- $40
        age_group_total,      -- $41
        age_group_label,      -- $42
        heart_rate_avg,       -- $43
        heart_rate_max,       -- $44
        actual_distance_km,   -- $45
        elevation_gain_m,     -- $46
        weather_temp_c,       -- $47
        weather_condition,    -- $48
        notes,                -- $49
        race_report,          -- $50
        results_url,          -- $51
        certificate_url,      -- $52
        facilities,           -- $53
        rpc_date_start,       -- $54
        rpc_date_end,         -- $55
        rpc_time,             -- $56
        rpc_location,         -- $57
        rpc_status,           -- $58
        rpc_attachment_path,  -- $59
        rpc_attachment_name,  -- $60
        rpc_notes,            -- $61
        mandatory_items,      -- $62
        strava_url,           -- $63
        result_file_path,     -- $64
        result_file_name,     -- $65
        registration_datetime -- $66
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,
        $43,$44,$45,$46,$47,$48,$49,$50,$51,$52,
        $53,$54,$55,$56,$57,$58,$59,$60,$61,$62,
        $63,$64,$65,$66
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
        str(b.timezone),                    // $13
        b.status || 'registered',           // $14
        num(b.registration_fee),            // $15
        b.registration_currency || 'USD',   // $16
        str(b.bib_number),                  // $17
        str(b.bib_name),                    // $18
        str(b.jersey_size),                 // $19
        str(b.registered_email),            // $20
        str(b.registered_phone),            // $21
        str(b.confirmation_number),         // $22
        str(b.finish_time_target),          // $23
        str(b.attachment_path),             // $24
        str(b.attachment_name),             // $25
        num(b.distance_km),                 // $26
        str(b.distance_label),              // $27
        str(b.race_type),                   // $28
        str(b.category),                    // $29
        num(b.elevation_gain_req_m),        // $30
        str(b.itra_point),                  // $31
        str(b.itra_url),                    // $32
        str(b.qualification),               // $33
        parseTimeToSeconds(b.finish_time),  // $34
        parseTimeToSeconds(b.gun_time),     // $35
        num(b.overall_place),               // $36
        num(b.overall_total),               // $37
        num(b.gender_place),                // $38
        num(b.gender_total),                // $39
        num(b.age_group_place),             // $40
        num(b.age_group_total),             // $41
        str(b.age_group_label),             // $42
        num(b.heart_rate_avg),              // $43
        num(b.heart_rate_max),              // $44
        num(b.actual_distance_km),          // $45
        num(b.elevation_gain_m),            // $46
        num(b.weather_temp_c),              // $47
        str(b.weather_condition),           // $48
        str(b.notes),                       // $49
        str(b.race_report),                 // $50
        str(b.results_url),                 // $51
        str(b.certificate_url),             // $52
        jsonArr(b.facilities),              // $53
        str(b.rpc_date_start),              // $54
        str(b.rpc_date_end),                // $55
        str(b.rpc_time),                    // $56
        str(b.rpc_location),                // $57
        b.rpc_status || 'not_collected',    // $58
        str(b.rpc_attachment_path),         // $59
        str(b.rpc_attachment_name),         // $60
        str(b.rpc_notes),                   // $61
        jsonArr(b.mandatory_items),         // $62
        str(b.strava_url),                  // $63
        str(b.result_file_path),            // $64
        str(b.result_file_name),            // $65
        registrationDateTime(b),            // $66
      ]
    );
    res.status(201).json(mapRace(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── UPDATE ────────────────────────────────────────────────────────────────
// 62 SET columns $1..$62, then id=$63 user_id=$64
router.put('/:id', async (req, res) => {
  const b = req.body;
  if (!b.event_name || !b.race_date) return res.status(400).json({ error: 'event_name and race_date required' });
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
        registration_datetime=$64, timezone=$65,
        updated_at=NOW()
      WHERE id=$66 AND user_id=$67 RETURNING *`,
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
        registrationDateTime(b),            // $64
        str(b.timezone),                    // $65
        req.params.id,                      // $66
        req.userId,                         // $67
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

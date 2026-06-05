import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function str(v) { return (v === '' || v === undefined) ? null : v; }

// ── LIST (optionally filter by year-month) ────────────────────────────────
router.get('/', async (req, res) => {
  const { year, month } = req.query;
  let query = `
    SELECT t.*, r.event_name AS race_name, r.race_date
    FROM training_plans t
    LEFT JOIN races r ON r.id = t.race_id AND r.user_id = t.user_id
    WHERE t.user_id = $1`;
  const params = [req.userId];
  let i = 2;
  if (year && month) {
    query += ` AND EXTRACT(YEAR FROM t.plan_date)=$${i++} AND EXTRACT(MONTH FROM t.plan_date)=$${i++}`;
    params.push(year, month);
  } else if (year) {
    query += ` AND EXTRACT(YEAR FROM t.plan_date)=$${i++}`;
    params.push(year);
  }
  query += ' ORDER BY t.plan_date, t.plan_time';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, r.event_name AS race_name FROM training_plans t
       LEFT JOIN races r ON r.id = t.race_id WHERE t.id=$1 AND t.user_id=$2`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── CREATE ────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, plan_date, plan_time, race_id, notes } = req.body;
  if (!name || !plan_date) return res.status(400).json({ error: 'name and plan_date required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO training_plans (user_id, name, plan_date, plan_time, race_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, name, plan_date, str(plan_time), str(race_id) || null, str(notes)]
    );
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── UPDATE ────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, plan_date, plan_time, race_id, notes } = req.body;
  if (!name || !plan_date) return res.status(400).json({ error: 'name and plan_date required' });
  try {
    const { rows } = await pool.query(
      `UPDATE training_plans SET name=$1, plan_date=$2, plan_time=$3, race_id=$4, notes=$5, updated_at=NOW()
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [name, plan_date, str(plan_time), str(race_id) || null, str(notes), req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM training_plans WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;

import cron from 'node-cron';
import pool from './db/pool.js';
import {
  emailEnabled,
  sendRaceReminder,
  sendRpcReminder,
  sendFillRpcReminder,
  sendFillResultsReminder,
} from './email.js';

// ── Date helpers ──────────────────────────────────────────────────────────
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Reminder jobs ─────────────────────────────────────────────────────────
async function runReminders() {
  if (!emailEnabled) return;

  const today    = dateOffset(0);
  const tomorrow = dateOffset(1);
  const in3days  = dateOffset(3);
  const in7days  = dateOffset(7);
  const minus3   = dateOffset(-3); // D+3 after race

  console.log(`[scheduler] Running reminders — today: ${today}`);

  let totals = { race: 0, rpc: 0, fillRpc7: 0, fillRpc3: 0, fillResults: 0 };

  try {

    // ── 1. D-1: Race day tomorrow ─────────────────────────────────────────
    const { rows: raceRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND u.is_active = true
    `, [tomorrow]);
    for (const row of raceRows) {
      await sendRaceReminder(row.email, row.name, row).catch(() => {});
    }
    totals.race = raceRows.length;

    // ── 2. D-1: Race pack collection starts tomorrow ──────────────────────
    const { rows: rpcRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.rpc_date_start = $1
        AND r.status IN ('registered', 'upcoming')
        AND u.is_active = true
    `, [tomorrow]);
    for (const row of rpcRows) {
      await sendRpcReminder(row.email, row.name, row).catch(() => {});
    }
    totals.rpc = rpcRows.length;

    // ── 3. D-7: Race in 7 days but no RPC details yet ─────────────────────
    const { rows: noRpc7Rows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND (r.rpc_date_start IS NULL OR r.rpc_date_start = '')
        AND u.is_active = true
    `, [in7days]);
    for (const row of noRpc7Rows) {
      await sendFillRpcReminder(row.email, row.name, row, 7).catch(() => {});
    }
    totals.fillRpc7 = noRpc7Rows.length;

    // ── 4. D-3: Race in 3 days but still no RPC details ───────────────────
    const { rows: noRpc3Rows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND (r.rpc_date_start IS NULL OR r.rpc_date_start = '')
        AND u.is_active = true
    `, [in3days]);
    for (const row of noRpc3Rows) {
      await sendFillRpcReminder(row.email, row.name, row, 3).catch(() => {});
    }
    totals.fillRpc3 = noRpc3Rows.length;

    // ── 5. D+3: Race was 3 days ago, status still registered/upcoming ─────
    const { rows: noResultRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND u.is_active = true
    `, [minus3]);
    for (const row of noResultRows) {
      await sendFillResultsReminder(row.email, row.name, row).catch(() => {});
    }
    totals.fillResults = noResultRows.length;

    console.log(
      `[scheduler] Done — race:${totals.race} rpc:${totals.rpc} ` +
      `fill-rpc-7:${totals.fillRpc7} fill-rpc-3:${totals.fillRpc3} ` +
      `fill-results:${totals.fillResults}`
    );

  } catch (err) {
    console.error('[scheduler] Error:', err.message);
  }
}

export function startScheduler() {
  if (!emailEnabled) {
    console.log('[scheduler] Email disabled — scheduler not started');
    return;
  }
  // Run every day at 08:00 server time
  cron.schedule('0 8 * * *', runReminders);
  console.log('[scheduler] Started — daily reminders at 08:00');
}

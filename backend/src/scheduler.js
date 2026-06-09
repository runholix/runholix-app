import cron from 'node-cron';
import pool from './db/pool.js';
import { sendRaceReminder, sendRpcReminder, emailEnabled } from './email.js';

/**
 * Runs at 08:00 every day.
 * Sends reminders for:
 *  - Races happening tomorrow (status: registered or upcoming, not dns/dnf/completed)
 *  - Race pack collections starting tomorrow
 */
async function runReminders() {
  if (!emailEnabled) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ds = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

  console.log(`[scheduler] Running reminders for ${ds}`);

  try {
    // D-1 race reminders
    const { rows: raceRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND u.is_active = true
    `, [ds]);

    for (const row of raceRows) {
      await sendRaceReminder(row.email, row.name, row);
    }

    // D-1 RPC start reminders
    const { rows: rpcRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.rpc_date_start = $1
        AND r.status IN ('registered', 'upcoming')
        AND u.is_active = true
    `, [ds]);

    for (const row of rpcRows) {
      await sendRpcReminder(row.email, row.name, row);
    }

    console.log(`[scheduler] Sent ${raceRows.length} race + ${rpcRows.length} RPC reminders`);
  } catch (err) {
    console.error('[scheduler] Error running reminders:', err.message);
  }
}

export function startScheduler() {
  if (!emailEnabled) {
    console.log('[scheduler] Email disabled — scheduler not started');
    return;
  }
  // Every day at 08:00 server time
  cron.schedule('0 8 * * *', runReminders);
  console.log('[scheduler] Started — reminders will run daily at 08:00');
}

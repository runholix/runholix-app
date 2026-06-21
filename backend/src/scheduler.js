import cron from 'node-cron';
import pool from './db/pool.js';
import {
  emailEnabled,
  sendRaceReminder,
  sendRpcReminder,
  sendRegistrationReminder,
  sendRegistrationFollowup,
  sendRpcEndReminder,
  sendFillRpcReminder,
  sendFillResultsReminder,
} from './email.js';

const DEFAULT_TZ = process.env.APP_TIMEZONE || 'UTC';

function zonedDateParts(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
}

function formatZonedDate(date, timeZone) {
  const parts = zonedDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function timezoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  const match = tzName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function localDateTimeToUtcMillis(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute, second = 0] = timeStr.split(':').map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const offset = timezoneOffsetMinutes(new Date(utc), timeZone);
    utc = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60 * 1000;
  }
  return utc;
}

async function runReminders() {
  if (!emailEnabled) return;

  const now = new Date();
  const nowUtc = now.toISOString();
  console.log(`[scheduler] Running reminders — ${nowUtc}`);

  let totals = { race: 0, rpc: 0, rpcEnd: 0, fillRpc7: 0, fillRpc3: 0, fillResults: 0, regD1: 0, regT1h: 0, regD3: 0 };

  try {
    const { rows: regRows } = await pool.query(`
      SELECT r.*, u.email AS user_email, u.name AS user_name,
             COALESCE(NULLIF(r.timezone, ''), NULLIF(u.timezone, ''), $1) AS effective_timezone
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.status = 'upcoming'
        AND r.registration_datetime IS NOT NULL
        AND u.is_active = TRUE
        AND (
          r.registration_reminder_d1_sent_at IS NULL
          OR r.registration_reminder_t1h_sent_at IS NULL
          OR r.registration_reminder_d3_sent_at IS NULL
        )
    `, [DEFAULT_TZ]);

    for (const row of regRows) {
      const tz = row.effective_timezone || DEFAULT_TZ;
      const localToday = formatZonedDate(now, tz);
      const regDate = String(row.registration_datetime).slice(0, 10);
      const regTime = String(row.registration_datetime).slice(11, 19);
      const localRegUtc = localDateTimeToUtcMillis(regDate, regTime, tz);
      const regD3 = addDays(regDate, 3);

      // ── 1. D-1: Race registration starts tomorrow ──────────────────────
      if (localToday === addDays(regDate, -1) && !row.registration_reminder_d1_sent_at) {
        await sendRegistrationReminder(row.user_email, row.user_name, row, 'd1').catch(() => {});
        await pool.query('UPDATE races SET registration_reminder_d1_sent_at = NOW() WHERE id = $1', [row.id]);
        totals.regD1 += 1;
      }

      // ── 2. T-1h: Race registration starts in 1 hour ──────────────────────
      if (regTime && localRegUtc !== null) {
        const oneHourBefore = localRegUtc - (60 * 60 * 1000);
        const minuteWindow = Math.abs(now.getTime() - oneHourBefore) < 60 * 1000;
        if (minuteWindow && !row.registration_reminder_t1h_sent_at) {
          await sendRegistrationReminder(row.user_email, row.user_name, row, 't1h').catch(() => {});
          await pool.query('UPDATE races SET registration_reminder_t1h_sent_at = NOW() WHERE id = $1', [row.id]);
          totals.regT1h += 1;
        }
      }

      // ── 3. D+3: Race registration was 3 days ago, status still upcoming ──────────────────────
      if (localToday === regD3 && !row.registration_reminder_d3_sent_at) {
        await sendRegistrationFollowup(row.user_email, row.user_name, row).catch(() => {});
        await pool.query('UPDATE races SET registration_reminder_d3_sent_at = NOW() WHERE id = $1', [row.id]);
        totals.regD3 += 1;
      }
    }

    const today = formatZonedDate(now, DEFAULT_TZ);
    const tomorrow = addDays(today, 1);
    const in3days = addDays(today, 3);
    const in7days = addDays(today, 7);
    const minus3 = addDays(today, -3);

    // ── 4. D-1: Race day tomorrow ─────────────────────────────────────────
    const { rows: raceRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND r.race_day_reminder_sent_at IS NULL
        AND u.is_active = true
    `, [tomorrow]);
    for (const row of raceRows) {
      await sendRaceReminder(row.email, row.name, row).catch(() => {});
      await pool.query('UPDATE races SET race_day_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
    }
    totals.race = raceRows.length;

    // ── 5. D-1: Race pack collection starts tomorrow ──────────────────────
    const { rows: rpcRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.rpc_date_start = $1
        AND r.status IN ('registered', 'upcoming')
        AND r.rpc_reminder_sent_at IS NULL
        AND u.is_active = true
    `, [tomorrow]);
    for (const row of rpcRows) {
      await sendRpcReminder(row.email, row.name, row).catch(() => {});
      await pool.query('UPDATE races SET rpc_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
    }
    totals.rpc = rpcRows.length;

    // ── 6. D day: Race pack collection ends today, RPC status still not collected ──────────────────────
    const { rows: rpcEndRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.rpc_date_end = $1
        AND r.status IN ('registered', 'upcoming')
        AND r.rpc_status = 'not_collected'
        AND r.rpc_end_reminder_sent_at IS NULL
        AND u.is_active = true
    `, [today]);
    for (const row of rpcEndRows) {
      await sendRpcEndReminder(row.email, row.name, row).catch(() => {});
      await pool.query('UPDATE races SET rpc_end_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
    }
    totals.rpcEnd = rpcEndRows.length;

    // ── 7. D-7: Race in 7 days but no RPC details yet ─────────────────────
    const { rows: noRpc7Rows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND (r.rpc_date_start IS NULL OR r.rpc_date_start = '')
        AND r.fill_rpc7_reminder_sent_at IS NULL
        AND u.is_active = true
    `, [in7days]);
    for (const row of noRpc7Rows) {
      await sendFillRpcReminder(row.email, row.name, row, 7).catch(() => {});
      await pool.query('UPDATE races SET fill_rpc7_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
    }
    totals.fillRpc7 = noRpc7Rows.length;

    // ── 8. D-3: Race in 3 days but still no RPC details ───────────────────
    const { rows: noRpc3Rows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND (r.rpc_date_start IS NULL OR r.rpc_date_start = '')
        AND r.fill_rpc3_reminder_sent_at IS NULL
        AND u.is_active = true
    `, [in3days]);
    for (const row of noRpc3Rows) {
      await sendFillRpcReminder(row.email, row.name, row, 3).catch(() => {});
      await pool.query('UPDATE races SET fill_rpc3_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
    }
    totals.fillRpc3 = noRpc3Rows.length;

    // ── 9. D+3: Race was 3 days ago, status still registered/upcoming ─────
    const { rows: noResultRows } = await pool.query(`
      SELECT r.*, u.email, u.name
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.race_date = $1
        AND r.status IN ('registered', 'upcoming')
        AND r.fill_results_reminder_sent_at IS NULL
        AND u.is_active = true
    `, [minus3]);
    for (const row of noResultRows) {
      await sendFillResultsReminder(row.email, row.name, row).catch(() => {});
      await pool.query('UPDATE races SET fill_results_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
    }
    totals.fillResults = noResultRows.length;

    console.log(
      `[scheduler] Done — reg-d1:${totals.regD1} reg-t1h:${totals.regT1h} reg-d3:${totals.regD3} ` +
      `race:${totals.race} rpc:${totals.rpc} rpc-end:${totals.rpcEnd} fill-rpc-7:${totals.fillRpc7} ` +
      `fill-rpc-3:${totals.fillRpc3} fill-results:${totals.fillResults}`
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
  cron.schedule('* * * * *', runReminders);
  console.log('[scheduler] Started — minute reminders');
}

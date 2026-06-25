import cron from 'node-cron';
import pg from 'pg';
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
import {
  pushEnabled,
  sendPushToUser,
  buildRegistrationReminderPush,
  buildRegistrationFollowupPush,
  buildRaceDayPush,
  buildRpcReminderPush,
  buildRpcEndReminderPush,
  buildFillRpcReminderPush,
  buildFillResultsReminderPush,
} from './push.js';

// ── Fix: return TIMESTAMP columns as raw strings so we control timezone interpretation.
// Without this, the pg driver blindly treats TIMESTAMP as UTC, which is wrong when
// the value is actually stored in the race's local timezone (e.g. Asia/Bangkok).
// Type 1114 = TIMESTAMP without time zone
pg.types.setTypeParser(1114, (val) => val);

const DEFAULT_TZ = process.env.APP_TIMEZONE || 'UTC';
let schedulerRunning = false;

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
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  const iso = d.toISOString();
  return Number.isNaN(Date.parse(iso)) ? null : iso.slice(0, 10);
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
  const dateParts = dateStr.split('-').map(Number);
  const timeParts = timeStr.split(':').map(Number);
  if (dateParts.length !== 3 || dateParts.some(n => !Number.isFinite(n))) return null;
  if (timeParts.length < 2 || timeParts.some(n => !Number.isFinite(n))) return null;
  const [year, month, day] = dateParts;
  const [hour, minute, second = 0] = timeParts;
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(utc)) return null;
  for (let i = 0; i < 3; i++) {
    const offset = timezoneOffsetMinutes(new Date(utc), timeZone);
    utc = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60 * 1000;
    if (!Number.isFinite(utc)) return null;
  }
  return utc;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(task, label, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await delay(200 * attempt);
      }
    }
  }
  console.error(`[scheduler] SMTP send failed after ${maxAttempts} attempts: ${label}`, lastErr?.message || lastErr);
  return null;
}

async function runWithConcurrency(tasks, concurrency = 3) {
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      const task = tasks[current];
      await task();
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
}

async function runReminders() {
  if (!emailEnabled && !pushEnabled) return;
  if (schedulerRunning) {
    console.log('[scheduler] Skipping run - previous execution still in progress');
    return;
  }

  schedulerRunning = true;
  const now = new Date();
  console.log(`[scheduler] Running reminders - ${now.toISOString()}`);

  const totals = {
    race: 0, rpc: 0, rpcEnd: 0, fillRpc7: 0, fillRpc3: 0, fillResults: 0,
    regD1: 0, regT1h: 0, regD3: 0,
    pushRace: 0, pushRpc: 0, pushRpcEnd: 0, pushFillRpc7: 0, pushFillRpc3: 0, pushFillResults: 0,
    pushRegD1: 0, pushRegT1h: 0, pushRegD3: 0,
  };
  const sendJobs = [];
  const updateBuckets = {
    registration_reminder_d1_sent_at: new Set(),
    registration_reminder_t1h_sent_at: new Set(),
    registration_reminder_d3_sent_at: new Set(),
    race_day_reminder_sent_at: new Set(),
    rpc_reminder_sent_at: new Set(),
    rpc_end_reminder_sent_at: new Set(),
    fill_rpc7_reminder_sent_at: new Set(),
    fill_rpc3_reminder_sent_at: new Set(),
    fill_results_reminder_sent_at: new Set(),
  };

  const flushUpdates = async () => {
    for (const [column, ids] of Object.entries(updateBuckets)) {
      if (!ids.size) continue;
      await pool.query(`UPDATE races SET ${column} = NOW() WHERE id = ANY($1::uuid[])`, [Array.from(ids)]);
    }
  };

  try {
    const { rows: regRows } = await pool.query(`
      SELECT r.id, r.event_name, r.race_date, r.status, r.registration_datetime,
             r.timezone, r.flag_off_time, r.cutoff_time, r.city, r.country,
             r.registration_reminder_d1_sent_at,
             r.registration_reminder_t1h_sent_at, r.registration_reminder_d3_sent_at,
             u.id AS user_id, u.email AS user_email, u.name AS user_name,
             u.email_reminder_enabled,
             COALESCE(NULLIF(r.timezone, ''), NULLIF(u.timezone, ''), $1) AS effective_timezone
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE r.status = 'upcoming'
        AND r.registration_datetime IS NOT NULL
        AND u.is_active = TRUE
        AND (u.email_reminder_enabled = TRUE OR EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = u.id AND is_enabled = TRUE))
        AND (
          r.registration_reminder_d1_sent_at IS NULL
          OR r.registration_reminder_t1h_sent_at IS NULL
          OR r.registration_reminder_d3_sent_at IS NULL
        )
    `, [DEFAULT_TZ]);

    for (const row of regRows) {
      const tz = row.effective_timezone || DEFAULT_TZ;
      const localToday = formatZonedDate(now, tz);

      // ── Fix: registration_datetime is TIMESTAMP stored in the race's local timezone.
      // The pg type parser override returns it as a raw string (e.g. "2025-06-10 10:00:00"),
      // so we slice date and time directly — no UTC reinterpretation needed.
      const regRaw = String(row.registration_datetime); // "2025-06-10 10:00:00"
      const regDate = regRaw.slice(0, 10);              // "2025-06-10" — already local calendar date
      const regTime = regRaw.slice(11, 19);             // "10:00:00"   — already local wall-clock time
      if (!/^\d{4}-\d{2}-\d{2}$/.test(regDate)) continue;

      // localDateTimeToUtcMillis now receives genuinely local values — correct
      const localRegUtc = localDateTimeToUtcMillis(regDate, regTime, tz);

      const regD1 = addDays(regDate, -1);
      const regD3 = addDays(regDate, 3);
      if (!regD1 || !regD3) continue;

      // ── 1. D-1: Race registration starts tomorrow ──────────────────────
      if (localToday === regD1 && !row.registration_reminder_d1_sent_at) {
        sendJobs.push(async () => {
          let delivered = false;
          if (emailEnabled && row.email_reminder_enabled) {
            const sent = await withRetry(() => sendRegistrationReminder(row.user_email, row.user_name, row, 'd1'), `registration d1 ${row.id}`);
            if (sent !== null) delivered = true;
          }
          if (pushEnabled) {
            const { sent } = await sendPushToUser(row.user_id, buildRegistrationReminderPush(row, 'd1'));
            if (sent > 0) {
              delivered = true;
              totals.pushRegD1 += 1;
            }
          }
          if (!delivered) return;
          updateBuckets.registration_reminder_d1_sent_at.add(row.id);
          totals.regD1 += 1;
        });
      }

      // ── 2. T-1h: Race registration starts in 1 hour ──────────────────────
      if (regTime && localRegUtc !== null) {
        const oneHourBefore = localRegUtc - (60 * 60 * 1000);
        if (Math.abs(now.getTime() - oneHourBefore) <= 5 * 60 * 1000 && !row.registration_reminder_t1h_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendRegistrationReminder(row.user_email, row.user_name, row, 't1h'), `registration t1h ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildRegistrationReminderPush(row, 't1h'));
              if (sent > 0) {
                delivered = true;
                totals.pushRegT1h += 1;
              }
            }
            if (!delivered) return;
            updateBuckets.registration_reminder_t1h_sent_at.add(row.id);
            totals.regT1h += 1;
          });
        }
      }

      // ── 3. D+3: Race registration was 3 days ago, status still upcoming ──────────────────────
      if (localToday === regD3 && !row.registration_reminder_d3_sent_at) {
        sendJobs.push(async () => {
          let delivered = false;
          if (emailEnabled && row.email_reminder_enabled) {
            const sent = await withRetry(() => sendRegistrationFollowup(row.user_email, row.user_name, row), `registration d3 ${row.id}`);
            if (sent !== null) delivered = true;
          }
          if (pushEnabled) {
            const { sent } = await sendPushToUser(row.user_id, buildRegistrationFollowupPush(row));
            if (sent > 0) {
              delivered = true;
              totals.pushRegD3 += 1;
            }
          }
          if (!delivered) return;
          updateBuckets.registration_reminder_d3_sent_at.add(row.id);
          totals.regD3 += 1;
        });
      }
    }

    // Widen the SQL fetch window by ±1 day around server time to cover all possible
    // user timezones (UTC-12 to UTC+14), then do per-row per-timezone date comparisons in JS.
    const serverToday = formatZonedDate(now, DEFAULT_TZ);
    const windowStart = addDays(serverToday, -4); // minus3 for the most-ahead timezone
    const windowEnd   = addDays(serverToday,  8); // in7days for the most-behind timezone
    if (!windowStart || !windowEnd) throw new Error('Invalid scheduler date window');

    const { rows: reminderRows } = await pool.query(`
      SELECT
        r.id,
        r.event_name,
        r.race_date,
        r.status,
        r.flag_off_time,
        r.cutoff_time,
        r.city,
        r.country,
        r.bib_number,
        r.distance_label,
        r.distance_km,
        r.rpc_date_start,
        r.rpc_date_end,
        r.rpc_time,
        r.rpc_location,
        r.rpc_status,
        r.race_day_reminder_sent_at,
        r.rpc_reminder_sent_at,
        r.rpc_end_reminder_sent_at,
        r.fill_rpc7_reminder_sent_at,
        r.fill_rpc3_reminder_sent_at,
        r.fill_results_reminder_sent_at,
        COALESCE(NULLIF(r.timezone, ''), NULLIF(u.timezone, ''), $1) AS effective_timezone,
        u.id AS user_id,
        u.email,
        u.name,
        u.email_reminder_enabled
      FROM races r
      JOIN users u ON u.id = r.user_id
      WHERE u.is_active = TRUE
        AND (u.email_reminder_enabled = TRUE OR EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = u.id AND is_enabled = TRUE))
        AND r.status IN ('registered', 'upcoming')
        AND (
        (r.race_date BETWEEN $2 AND $3 AND (r.race_day_reminder_sent_at IS NULL OR r.fill_rpc7_reminder_sent_at IS NULL OR r.fill_rpc3_reminder_sent_at IS NULL OR r.fill_results_reminder_sent_at IS NULL))
          OR (r.rpc_date_start BETWEEN $2 AND $3 AND r.rpc_status = 'not_collected' AND r.rpc_reminder_sent_at IS NULL)
          OR (r.rpc_date_end BETWEEN $2 AND $3 AND r.rpc_status = 'not_collected' AND r.rpc_end_reminder_sent_at IS NULL)
        )
    `, [DEFAULT_TZ, windowStart, windowEnd]);

    // Group rows by effective timezone so we compute local dates once per zone
    const byTz = {};
    for (const row of reminderRows) {
      const tz = row.effective_timezone || DEFAULT_TZ;
      (byTz[tz] ??= []).push(row);
    }

    for (const [tz, tzRows] of Object.entries(byTz)) {
      const localToday = formatZonedDate(now, tz);
      const tomorrow   = addDays(localToday, 1);
      const in3days    = addDays(localToday, 3);
      const in7days    = addDays(localToday, 7);
      const minus3     = addDays(localToday, -3);
      if (!tomorrow || !in3days || !in7days || !minus3) continue;

      for (const row of tzRows) {
        const payload = { ...row, timezone: tz };

        // ── 4. D-1: Race day tomorrow ───────────────────────────────────────
        if (row.race_date === tomorrow && !row.race_day_reminder_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendRaceReminder(row.email, row.name, payload), `race reminder ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildRaceDayPush(payload));
              if (sent > 0) { delivered = true; totals.pushRace += 1; }
            }
            if (!delivered) return;
            updateBuckets.race_day_reminder_sent_at.add(row.id);
            totals.race += 1;
          });
        }

        // ── 5. D-1: Race pack collection starts tomorrow ────────────────────
        if (row.rpc_date_start === tomorrow && row.rpc_status === 'not_collected' && !row.rpc_reminder_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendRpcReminder(row.email, row.name, payload), `rpc reminder ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildRpcReminderPush(payload));
              if (sent > 0) { delivered = true; totals.pushRpc += 1; }
            }
            if (!delivered) return;
            updateBuckets.rpc_reminder_sent_at.add(row.id);
            totals.rpc += 1;
          });
        }

        // ── 6. D day: RPC ends today, still not collected ───────────────────
        if (row.rpc_date_end === localToday && row.rpc_status === 'not_collected' && !row.rpc_end_reminder_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendRpcEndReminder(row.email, row.name, payload), `rpc end reminder ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildRpcEndReminderPush(payload));
              if (sent > 0) { delivered = true; totals.pushRpcEnd += 1; }
            }
            if (!delivered) return;
            updateBuckets.rpc_end_reminder_sent_at.add(row.id);
            totals.rpcEnd += 1;
          });
        }

        // ── 7. D-7: Race in 7 days, no RPC details yet ─────────────────────
        if (row.race_date === in7days && row.rpc_status === 'not_collected' && !row.rpc_date_start && !row.fill_rpc7_reminder_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendFillRpcReminder(row.email, row.name, payload, 7), `fill rpc 7 ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildFillRpcReminderPush(payload, 7));
              if (sent > 0) { delivered = true; totals.pushFillRpc7 += 1; }
            }
            if (!delivered) return;
            updateBuckets.fill_rpc7_reminder_sent_at.add(row.id);
            totals.fillRpc7 += 1;
          });
        }

        // ── 8. D-3: Race in 3 days, still no RPC details ───────────────────
        if (row.race_date === in3days && row.rpc_status === 'not_collected' && !row.rpc_date_start && !row.fill_rpc3_reminder_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendFillRpcReminder(row.email, row.name, payload, 3), `fill rpc 3 ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildFillRpcReminderPush(payload, 3));
              if (sent > 0) { delivered = true; totals.pushFillRpc3 += 1; }
            }
            if (!delivered) return;
            updateBuckets.fill_rpc3_reminder_sent_at.add(row.id);
            totals.fillRpc3 += 1;
          });
        }

        // ── 9. D+3: Race was 3 days ago, still registered/upcoming ─────────
        if (row.race_date === minus3 && !row.fill_results_reminder_sent_at) {
          sendJobs.push(async () => {
            let delivered = false;
            if (emailEnabled && row.email_reminder_enabled) {
              const sent = await withRetry(() => sendFillResultsReminder(row.email, row.name, payload), `fill results ${row.id}`);
              if (sent !== null) delivered = true;
            }
            if (pushEnabled) {
              const { sent } = await sendPushToUser(row.user_id, buildFillResultsReminderPush(payload));
              if (sent > 0) { delivered = true; totals.pushFillResults += 1; }
            }
            if (!delivered) return;
            updateBuckets.fill_results_reminder_sent_at.add(row.id);
            totals.fillResults += 1;
          });
        }
      }
    }

    await runWithConcurrency(sendJobs, 3);

    await flushUpdates();

    console.log(
      `[scheduler] Done - reg-d1:${totals.regD1} reg-t1h:${totals.regT1h} reg-d3:${totals.regD3} ` +
      `race:${totals.race} rpc:${totals.rpc} rpc-end:${totals.rpcEnd} fill-rpc-7:${totals.fillRpc7} ` +
      `fill-rpc-3:${totals.fillRpc3} fill-results:${totals.fillResults} ` +
      `push-reg-d1:${totals.pushRegD1} push-reg-t1h:${totals.pushRegT1h} push-reg-d3:${totals.pushRegD3} ` +
      `push-race:${totals.pushRace} push-rpc:${totals.pushRpc} push-rpc-end:${totals.pushRpcEnd} ` +
      `push-fill-rpc-7:${totals.pushFillRpc7} push-fill-rpc-3:${totals.pushFillRpc3} push-fill-results:${totals.pushFillResults}`
    );
  } catch (err) {
    console.error('[scheduler] Error:', err.message);
  } finally {
    schedulerRunning = false;
  }
}

export function startScheduler() {
  if (!emailEnabled && !pushEnabled) {
    console.log('[scheduler] Email and push disabled - scheduler not started');
    return;
  }
  cron.schedule('01,31 * * * *', runReminders);
  console.log('[scheduler] Started - runs at minute 01 and 31');
}

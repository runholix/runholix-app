import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(str) {
  // RFC 5545 text escaping: \ ; , \n
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  // RFC 5545 line folding: max 75 octets, fold with CRLF + space
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line + '\r\n';
  let result = '';
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const len = first ? 75 : 74; // 74 because continuation starts with space
    const chunk = bytes.slice(start, start + len);
    result += (first ? '' : ' ') + chunk.toString('utf8') + '\r\n';
    start += len;
    first = false;
  }
  return result;
}

function prop(name, value, params = '') {
  const line = params ? `${name};${params}:${value}` : `${name}:${value}`;
  return foldLine(line);
}

function toIcsDate(dateStr) {
  // YYYY-MM-DD → all-day date VALUE=DATE
  return dateStr.replace(/-/g, '');
}

function toIcsDateTime(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM or null → YYYYMMDDTHHMMSS (local, no Z)
  const base = dateStr.replace(/-/g, '');
  if (!timeStr) return base + 'T000000';
  const t = timeStr.replace(/:/g, '').slice(0, 6).padEnd(6, '0');
  return base + 'T' + t;
}

function buildIcs(userId, userName, races, training) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + 'Z';
  const prodId = '-//RaceTracker//RaceTracker Calendar Feed//EN';

  let cal = '';
  cal += 'BEGIN:VCALENDAR\r\n';
  cal += prop('VERSION', '2.0');
  cal += prop('PRODID', esc(prodId));
  cal += prop('CALSCALE', 'GREGORIAN');
  cal += prop('METHOD', 'PUBLISH');
  cal += prop('X-WR-CALNAME', esc(`${userName}'s ${process.env.APP_NAME || 'Runholix'}`));
  cal += prop('X-WR-CALDESC', 'Races, race pack collection dates, and training plans');
  cal += prop('X-WR-TIMEZONE', 'UTC');
  cal += prop('REFRESH-INTERVAL;VALUE=DURATION', 'PT1H');
  cal += prop('X-PUBLISHED-TTL', 'PT1H');

  // ── Race events ──────────────────────────────────────────────────────────
  for (const r of races) {
    if (!r.race_date) continue;

    const uid = `race-${r.id}@runholix`;
    const startDate = toIcsDate(r.race_date.slice(0, 10));

    // All-day event for the race date
    let summary = r.event_name;
    if (r.distance_label) summary += ` (${r.distance_label})`;
    else if (r.distance_km) summary += ` (${parseFloat(r.distance_km).toFixed(1)} km)`;

    const locationParts = [r.location, r.city, r.country].filter(Boolean);

    let desc = '';
    if (r.bib_number)    desc += `Bib: #${r.bib_number}\\n`;
    if (r.flag_off_time) desc += `Flag off: ${r.flag_off_time}\\n`;
    if (r.cutoff_time)   desc += `Cut off: ${r.cutoff_time}\\n`;
    if (r.category)      desc += `Category: ${r.category}\\n`;
    if (r.status)        desc += `Status: ${r.status}\\n`;
    if (r.website_url)   desc += `Website: ${r.website_url}\\n`;

    cal += 'BEGIN:VEVENT\r\n';
    cal += prop('UID', uid);
    cal += prop('DTSTAMP', now);
    cal += prop('DTSTART;VALUE=DATE', startDate);
    cal += prop('DTEND;VALUE=DATE', startDate); // all-day: end = same day
    cal += prop('SUMMARY', esc(summary));
    if (desc)                   cal += prop('DESCRIPTION', esc(desc));
    if (locationParts.length)   cal += prop('LOCATION', esc(locationParts.join(', ')));
    cal += prop('STATUS', r.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE');
    cal += prop('CATEGORIES', 'RACE');
    cal += prop('COLOR', 'BLUE');
    cal += 'END:VEVENT\r\n';

    // ── RPC range events ─────────────────────────────────────────────────
    if (r.rpc_date_start) {
      const rpcStart = toIcsDate(r.rpc_date_start.slice(0, 10));
      // ICS all-day DTEND is exclusive, so add 1 day to end
      const endDate = r.rpc_date_end
        ? new Date(r.rpc_date_end.slice(0, 10))
        : new Date(r.rpc_date_start.slice(0, 10));
      endDate.setDate(endDate.getDate() + 1);
      const rpcEnd = endDate.toISOString().slice(0, 10).replace(/-/g, '');

      let rpcDesc = `Race pack collection for ${r.event_name}\\n`;
      if (r.rpc_time)     rpcDesc += `Hours: ${r.rpc_time}\\n`;
      if (r.rpc_location) rpcDesc += `Location: ${r.rpc_location}\\n`;

      const rpcStatus = r.rpc_status === 'collected' ? 'Collected ✓' : 'Not collected yet';
      rpcDesc += `Status: ${rpcStatus}\\n`;

      cal += 'BEGIN:VEVENT\r\n';
      cal += prop('UID', `rpc-${r.id}@racetracker`);
      cal += prop('DTSTAMP', now);
      cal += prop('DTSTART;VALUE=DATE', rpcStart);
      cal += prop('DTEND;VALUE=DATE', rpcEnd);
      cal += prop('SUMMARY', esc(`📦 RPC: ${r.event_name}`));
      cal += prop('DESCRIPTION', esc(rpcDesc));
      if (r.rpc_location) cal += prop('LOCATION', esc(r.rpc_location));
      cal += prop('STATUS', 'CONFIRMED');
      cal += prop('CATEGORIES', 'RACE-PACK');
      cal += prop('COLOR', 'YELLOW');
      cal += 'END:VEVENT\r\n';
    }
  }

  // ── Training plan events ─────────────────────────────────────────────────
  for (const t of training) {
    if (!t.plan_date) continue;

    const dateStr = t.plan_date.slice(0, 10);
    let desc = '';
    if (t.plan_time) desc += `Time: ${t.plan_time}\\n`;
    if (t.race_name) desc += `Related race: ${t.race_name}\\n`;
    if (t.notes)     desc += `\\n${t.notes}`;

    cal += 'BEGIN:VEVENT\r\n';
    cal += prop('UID', `training-${t.id}@racetracker`);
    cal += prop('DTSTAMP', now);
    cal += prop('DTSTART;VALUE=DATE', toIcsDate(dateStr));
    cal += prop('DTEND;VALUE=DATE', toIcsDate(dateStr));
    cal += prop('SUMMARY', esc(`📋 ${t.name}`));
    if (desc) cal += prop('DESCRIPTION', esc(desc));
    cal += prop('STATUS', 'CONFIRMED');
    cal += prop('CATEGORIES', 'TRAINING');
    cal += prop('COLOR', 'GREEN');
    cal += 'END:VEVENT\r\n';
  }

  cal += 'END:VCALENDAR\r\n';
  return cal;
}

// ── GET /ical/:token ──────────────────────────────────────────────────────
// Public — authenticated by the secret token embedded in the URL.
// Calendar clients subscribe to this URL and poll it automatically.
router.get('/:token.ics', async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      'SELECT id, name FROM users WHERE ical_token = $1 AND ical_enabled = TRUE',
      [req.params.token]
    );
    if (!users.length) return res.status(404).send('Calendar feed not found or disabled.');

    const { id: userId, name } = users[0];

    // Fetch all races — cast date columns to text so .slice() is safe
    const { rows: races } = await pool.query(
      `SELECT *,
         race_date::text        AS race_date,
         rpc_date_start::text   AS rpc_date_start,
         rpc_date_end::text     AS rpc_date_end
       FROM races WHERE user_id = $1 ORDER BY races.race_date DESC`,
      [userId]
    );

    // Fetch all training plans (with race name) — cast date to text
    const { rows: training } = await pool.query(
      `SELECT t.*,
         t.plan_date::text      AS plan_date,
         r.event_name           AS race_name
       FROM training_plans t
       LEFT JOIN races r ON r.id = t.race_id AND r.user_id = t.user_id
       WHERE t.user_id = $1 ORDER BY t.plan_date`,
      [userId]
    );

    const ics = buildIcs(userId, name, races, training);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="racetracker.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(ics);

  } catch (err) {
    console.error('[ical]', err);
    res.status(500).send('Error generating calendar feed.');
  }
});

export default router;

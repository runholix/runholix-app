import nodemailer from 'nodemailer';

// ── Build transport from env vars ─────────────────────────────────────────
function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // email disabled

  const port      = parseInt(process.env.SMTP_PORT || '587');
  const secureMode = (process.env.SMTP_SECURE || 'tls').toLowerCase();
  const secure     = secureMode === 'ssl';
  const requireTLS = secureMode === 'tls';
  const pool = String(process.env.SMTP_POOL || 'true').toLowerCase() !== 'false';
  const maxConnections = Math.max(1, parseInt(process.env.SMTP_POOL_MAX_CONNECTIONS || '3', 10) || 3);
  const maxMessages = Math.max(1, parseInt(process.env.SMTP_POOL_MAX_MESSAGES || '100', 10) || 100);

  return nodemailer.createTransport({
    host, port, secure,
    pool,
    maxConnections,
    maxMessages,
    requireTLS: requireTLS && !secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

const transport = createTransport();
const FROM    = process.env.SMTP_FROM || `${APP_NAME} <noreply@example.com>`;
const APP_URL = (process.env.APP_URL || 'http://localhost').replace(/\/$/, '');
const APP_NAME = process.env.APP_NAME || 'Runholix';

export const emailEnabled = !!transport;

async function send(to, subject, html) {
  if (!transport) {
    console.log(`[email disabled] To: ${to} | ${subject}`);
    return;
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, html });
    console.log(`[email sent] To: ${to} | ${subject}`);
  } catch (err) {
    console.error(`[email error] To: ${to} | ${err.message}`);
  }
}

function wrap(title, body) {
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7f4;margin:0;padding:24px}
.card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;padding:32px}
h1{font-size:20px;font-weight:700;margin:0 0 16px;color:#1a1917}
p{font-size:14px;line-height:1.6;color:#4b4a48;margin:0 0 12px}
.btn{display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0}
.info{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 16px;margin:16px 0}
.info p{margin:4px 0;font-size:13px;color:#0369a1}.info strong{color:#1a1917}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600}
.badge-race{background:#dbeafe;color:#1d40b0}.badge-rpc{background:#fef9c3;color:#854d0e}
footer{text-align:center;font-size:12px;color:#9b9890;margin-top:24px}
</style></head>
<body><div class="card"><h1>🏃 ${title}</h1>${body}</div>
<footer>${APP_NAME} · <a href="${APP_URL}" style="color:#1d4ed8">${APP_URL}</a></footer>
</body></html>`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function sendActivationEmail(to, name, token) {
  const link = `${APP_URL}/activate?token=${encodeURIComponent(token)}`;
  await send(to, `Activate your ${APP_NAME} account`, wrap('Activate your account', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>Thanks for signing up to ${escHtml(APP_NAME)}! Click below to activate your account.</p>
    <a href="${link}" class="btn">Activate my account</a>
    <p style="font-size:12px;color:#9b9890">Link expires in 24 hours. If you did not sign up, ignore this email.</p>
    <p style="font-size:12px;color:#9b9890">Or copy: ${link}</p>
  `));
}

export async function sendWelcomeEmail(to, name) {
  await send(to, `Welcome to ${APP_NAME}!`, wrap(`Welcome to ${APP_NAME}! 🎉`, `
    <p>Hi <strong>${escHtml(name)}</strong>, your account is now active.</p>
    <p>Start adding your races and training plans!</p>
    <a href="${APP_URL}" class="btn">Go to ${escHtml(APP_NAME)}</a>
  `));
}

export async function sendRaceReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  await send(to, `⏰ Tomorrow: ${race.event_name}`, wrap(`Tomorrow: ${escHtml(race.event_name)}!`, `
    <p>Hi <strong>${escHtml(name)}</strong>, tomorrow is race day!</p>
    <div class="info">
      <p><strong>${escHtml(race.event_name)}</strong> <span class="badge badge-race">Race</span></p>
      <p>📅 <strong>Date:</strong> ${escHtml(fmtDate(race.race_date))}</p>
      ${race.flag_off_time ? `<p>🕐 <strong>Flag off:</strong> ${escHtml(race.flag_off_time)}</p>` : ''}
      ${race.cutoff_time   ? `<p>⏱ <strong>Cut off:</strong> ${escHtml(race.cutoff_time)}</p>` : ''}
      ${race.city          ? `<p>📍 <strong>Location:</strong> ${escHtml(race.city)}${race.country ? ', ' + escHtml(race.country) : ''}</p>` : ''}
      ${race.bib_number    ? `<p>🔖 <strong>Bib:</strong> #${escHtml(race.bib_number)}</p>` : ''}
      ${race.distance_label || race.distance_km ? `<p>🏃 <strong>Distance:</strong> ${escHtml(race.distance_label || race.distance_km + ' km')}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
    <p>Good luck, ${escHtml(name)}! You've got this 💪</p>
  `));
}

export async function sendRegistrationReminder(to, name, race, kind = 'd1') {
  const link = `${APP_URL}/races/${race.id}`;
  const isHour = kind === 't1h';
  const subject = isHour
    ? `1 hour to go: register for ${race.event_name}`
    : `Tomorrow: register for ${race.event_name}`;
  const heading = isHour
    ? `1 hour to go: ${race.event_name}`
    : `Tomorrow: ${race.event_name}`;
  const bodyLead = isHour
    ? `Your race registration starts in about 1 hour.`
    : `Your race registration starts tomorrow.`;

  await send(to, subject, wrap(heading, `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>${escHtml(bodyLead)}</p>
    <div class="info">
      <p><strong>${escHtml(race.event_name)}</strong> <span class="badge badge-race">Race</span></p>
      <p><strong>Race date:</strong> ${escHtml(fmtDate(race.race_date))}</p>
      ${race.flag_off_time ? `<p><strong>Flag off:</strong> ${escHtml(race.flag_off_time)}</p>` : ''}
      ${race.cutoff_time ? `<p><strong>Cut off:</strong> ${escHtml(race.cutoff_time)}</p>` : ''}
      ${race.city ? `<p><strong>Location:</strong> ${escHtml(race.city)}${race.country ? ', ' + escHtml(race.country) : ''}</p>` : ''}
      ${race.timezone ? `<p><strong>Timezone:</strong> ${escHtml(race.timezone)}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
    <p style="font-size:12px;color:#9b9890">Open the race details page to review your event and complete registration.</p>
  `));
}

export async function sendRegistrationFollowup(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  await send(to, `Update your race details: ${race.event_name}`, wrap(`Update your race details`, `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>It has been a few days since the race registration opened. Please review and update the race details if anything has changed.</p>
    <div class="info">
      <p><strong>${escHtml(race.event_name)}</strong> <span class="badge badge-race">Race</span></p>
      <p><strong>Race date:</strong> ${escHtml(fmtDate(race.race_date))}</p>
      ${race.flag_off_time ? `<p><strong>Flag off:</strong> ${escHtml(race.flag_off_time)}</p>` : ''}
      ${race.cutoff_time ? `<p><strong>Cut off:</strong> ${escHtml(race.cutoff_time)}</p>` : ''}
      ${race.city ? `<p><strong>Location:</strong> ${escHtml(race.city)}${race.country ? ', ' + escHtml(race.country) : ''}</p>` : ''}
      ${race.timezone ? `<p><strong>Timezone:</strong> ${escHtml(race.timezone)}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
    <p style="font-size:12px;color:#9b9890">Open the race details page to update any missing or changed information.</p>
  `));
}

export async function sendRpcEndReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  await send(to, `Race pack collection ends today: ${race.event_name}`, wrap('Race pack collection ends today', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>Race pack collection for <strong>${escHtml(race.event_name)}</strong> ends today and your status still shows as not collected.</p>
    <div class="info">
      <p><strong>${escHtml(race.event_name)}</strong> <span class="badge badge-rpc">Race Pack</span></p>
      <p><strong>Race date:</strong> ${escHtml(fmtDate(race.race_date))}</p>
      ${race.rpc_date_start ? `<p><strong>Collection start:</strong> ${escHtml(fmtDate(race.rpc_date_start))}</p>` : ''}
      ${race.rpc_date_end ? `<p><strong>Collection end:</strong> ${escHtml(fmtDate(race.rpc_date_end))}</p>` : ''}
      ${race.rpc_time ? `<p><strong>Hours:</strong> ${escHtml(race.rpc_time)}</p>` : ''}
      ${race.rpc_location ? `<p><strong>Location:</strong> ${escHtml(race.rpc_location)}</p>` : ''}
      ${race.timezone ? `<p><strong>Timezone:</strong> ${escHtml(race.timezone)}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
    <p style="font-size:12px;color:#9b9890">Open the race details page to complete collection before it closes.</p>
  `));
}

export async function sendRpcReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  await send(to, `📦 Tomorrow: Race pack collection — ${race.event_name}`, wrap(`Race pack collection starts tomorrow`, `
    <p>Hi <strong>${escHtml(name)}</strong>, race pack collection for your upcoming race starts tomorrow.</p>
    <div class="info">
      <p><strong>${escHtml(race.event_name)}</strong> <span class="badge badge-rpc">Race Pack</span></p>
      <p>📅 <strong>Collection dates:</strong> ${escHtml(fmtDate(race.rpc_date_start))}${race.rpc_date_end && race.rpc_date_end !== race.rpc_date_start ? ' – ' + escHtml(fmtDate(race.rpc_date_end)) : ''}</p>
      ${race.rpc_time     ? `<p>🕐 <strong>Hours:</strong> ${escHtml(race.rpc_time)}</p>` : ''}
      ${race.rpc_location ? `<p>📍 <strong>Location:</strong> ${escHtml(race.rpc_location)}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
  `));
}

// ── Password changed notification ─────────────────────────────────────────
export async function sendPasswordChangedEmail(to, name) {
  await send(to, `Your ${APP_NAME} password was changed`, wrap('Password changed', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>Your ${escHtml(APP_NAME)} password was successfully changed.</p>
    <p>If you did not make this change, please contact support immediately and change your password.</p>
    <a href="${APP_URL}" class="btn">Go to ${escHtml(APP_NAME)}</a>
  `));
}

export async function sendPasswordResetEmail(to, name, token) {
  const link = `${APP_URL}/forgot-password?token=${encodeURIComponent(token)}`;
  await send(to, `Reset your ${APP_NAME} password`, wrap('Reset your password', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>We received a request to reset your ${escHtml(APP_NAME)} password.</p>
    <a href="${link}" class="btn">Reset password</a>
    <p style="font-size:12px;color:#9b9890">This link expires in 30 minutes. If you did not request a reset, ignore this email.</p>
    <p style="font-size:12px;color:#9b9890">Or copy: ${link}</p>
  `));
}

export async function sendPasskeyAddedEmail(to, name, passkeyName) {
  await send(to, `A passkey was added to your ${APP_NAME} account`, wrap('Passkey added', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>A new passkey named <strong>${escHtml(passkeyName)}</strong> was added to your ${escHtml(APP_NAME)} account.</p>
    <p>If you did not make this change, remove the passkey from account settings and change your password immediately.</p>
    <a href="${APP_URL}/settings" class="btn">Review security settings</a>
  `));
}

export async function sendPasskeyRemovedEmail(to, name, passkeyName) {
  await send(to, `A passkey was removed from your ${APP_NAME} account`, wrap('Passkey removed', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>The passkey named <strong>${escHtml(passkeyName)}</strong> was removed from your ${escHtml(APP_NAME)} account.</p>
    <p>If you did not make this change, change your password immediately and review your account settings.</p>
    <a href="${APP_URL}/settings" class="btn">Review security settings</a>
  `));
}

// ── Email change confirmation ─────────────────────────────────────────────
export async function sendEmailChangeConfirmation(to, name, token) {
  const link = `${APP_URL}/confirm-email?token=${encodeURIComponent(token)}`;
  await send(to, 'Confirm your new email address', wrap('Confirm new email address', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>You requested to change your ${escHtml(APP_NAME)} email address to <strong>${escHtml(to)}</strong>.</p>
    <p>Click below to confirm this change. The link expires in 24 hours.</p>
    <a href="${link}" class="btn">Confirm new email</a>
    <p style="font-size:12px;color:#9b9890">If you did not request this, ignore this email. Your current email will remain unchanged.</p>
    <p style="font-size:12px;color:#9b9890">Or copy: ${link}</p>
  `));
}

// ── Admin approval request ───────────────────────────────────────────────
export async function sendAdminApprovalRequest(adminEmail, user, reviewUrl) {
  await send(adminEmail, `New user awaiting approval: ${user.name}`, wrap('New account approval required', `
    <p>A new user has confirmed their email address and is awaiting your approval to access ${escHtml(APP_NAME)}.</p>
    <div class="info">
      <p><strong>Name:</strong> ${escHtml(user.name)}</p>
      <p><strong>Email:</strong> ${escHtml(user.email)}</p>
    </div>
    <p>Please review and take action:</p>
    <a href="${reviewUrl}" class="btn" style="display:block;text-align:center">Open approval review</a>
    <p style="font-size:12px;color:#9b9890;margin-top:16px">Review link: ${reviewUrl}</p>
  `));
}

// ── User approved notification ────────────────────────────────────────────
export async function sendAccountApproved(to, name, adminMessage = '') {
  const link = `${APP_URL}/login`;
  await send(to, `Your ${APP_NAME} account has been approved!`, wrap('Account approved 🎉', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>Great news — an admin has approved your ${escHtml(APP_NAME)} account. You can now sign in and start tracking your races!</p>
    ${adminMessage?.trim() ? `<div class="info"><p><strong>Admin message:</strong><br>${escHtml(adminMessage).replace(/\n/g, '<br>')}</p></div>` : ''}
    <a href="${link}" class="btn">Sign in now</a>
    <p style="font-size:12px;color:#9b9890">If you did not register for ${escHtml(APP_NAME)}, you can ignore this email.</p>
  `));
}

// ── User rejection notification ───────────────────────────────────────────
export async function sendAccountRejected(to, name, adminMessage = '') {
  await send(to, `Your ${APP_NAME} account was not approved`, wrap('Account not approved', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>An administrator reviewed your ${escHtml(APP_NAME)} account request and rejected it.</p>
    ${adminMessage?.trim() ? `<div class="info"><p><strong>Admin message:</strong><br>${escHtml(adminMessage).replace(/\n/g, '<br>')}</p></div>` : ''}
    <p style="font-size:12px;color:#9b9890">If you think this was a mistake, please contact the administrator who manages this account.</p>
  `));
}

// ── RPC details missing reminder ─────────────────────────────────────────
export async function sendFillRpcReminder(to, name, race, daysUntil) {
  const link = `${APP_URL}/races/${race.id}`;
  const subject = `Reminder: Add race pack collection details for ${race.event_name} (${daysUntil} days away)`;
  await send(to, subject, wrap('Race pack collection details missing', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>Your race <strong>${escHtml(race.event_name)}</strong> is only <strong>${escHtml(daysUntil)} day${daysUntil !== 1 ? 's' : ''} away</strong> 
       on <strong>${escHtml(fmtDate(race.race_date))}</strong>, but you haven't filled in the race pack collection details yet.</p>
    <p>Make sure you know when and where to collect your race pack so you're ready on race day!</p>
    <a href="${link}" class="btn">Fill in RPC details →</a>
    <div class="info">
      <p><strong>Race:</strong> ${escHtml(race.event_name)}</p>
      <p><strong>Race date:</strong> ${escHtml(fmtDate(race.race_date))}</p>
      ${race.city ? `<p><strong>Location:</strong> ${escHtml(race.city)}${race.country ? ', ' + escHtml(race.country) : ''}</p>` : ''}
      ${race.distance_label || race.distance_km ? `<p><strong>Distance:</strong> ${escHtml(race.distance_label || race.distance_km + ' km')}</p>` : ''}
    </div>
    <p style="font-size:12px;color:#9b9890">You're receiving this because you have a race registered in ${escHtml(APP_NAME)}.</p>
  `));
}

// ── Fill race results reminder ────────────────────────────────────────────
export async function sendFillResultsReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  const subject = `How did ${race.event_name} go? Fill in your results!`;
  await send(to, subject, wrap('Fill in your race results 🏅', `
    <p>Hi <strong>${escHtml(name)}</strong>,</p>
    <p>It's been 3 days since <strong>${escHtml(race.event_name)}</strong> on <strong>${escHtml(fmtDate(race.race_date))}</strong>. 
       How did it go? Your race status is still showing as <em>${escHtml(race.status)}</em>.</p>
    <p>Head over to ${escHtml(APP_NAME)} to log your finish time, placement, and write up your race report while the memories are fresh!</p>
    <a href="${link}" class="btn">Fill in race results →</a>
    <div class="info">
      <p><strong>Race:</strong> ${escHtml(race.event_name)}</p>
      <p><strong>Race date:</strong> ${escHtml(fmtDate(race.race_date))}</p>
      ${race.city ? `<p><strong>Location:</strong> ${escHtml(race.city)}${race.country ? ', ' + escHtml(race.country) : ''}</p>` : ''}
      ${race.distance_label || race.distance_km ? `<p><strong>Distance:</strong> ${escHtml(race.distance_label || race.distance_km + ' km')}</p>` : ''}
      ${race.bib_number ? `<p><strong>Bib:</strong> #${escHtml(race.bib_number)}</p>` : ''}
    </div>
    <p style="font-size:12px;color:#9b9890">You're receiving this because you have a race registered in ${escHtml(APP_NAME)}.</p>
  `));
}

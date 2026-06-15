import nodemailer from 'nodemailer';

// ── Build transport from env vars ─────────────────────────────────────────
function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // email disabled

  const port      = parseInt(process.env.SMTP_PORT || '587');
  const secureMode = (process.env.SMTP_SECURE || 'tls').toLowerCase();
  const secure     = secureMode === 'ssl';
  const requireTLS = secureMode === 'tls';

  return nodemailer.createTransport({
    host, port, secure,
    requireTLS: requireTLS && !secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

const transport = createTransport();
const FROM    = process.env.SMTP_FROM || 'Race Tracker <noreply@example.com>';
const APP_URL = (process.env.APP_URL || 'http://localhost').replace(/\/$/, '');

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
<footer>Race Tracker · <a href="${APP_URL}" style="color:#1d4ed8">${APP_URL}</a></footer>
</body></html>`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function sendActivationEmail(to, name, token) {
  const link = `${APP_URL}/activate?token=${encodeURIComponent(token)}`;
  await send(to, 'Activate your Race Tracker account', wrap('Activate your account', `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Thanks for signing up to Race Tracker! Click below to activate your account.</p>
    <a href="${link}" class="btn">Activate my account</a>
    <p style="font-size:12px;color:#9b9890">Link expires in 24 hours. If you did not sign up, ignore this email.</p>
    <p style="font-size:12px;color:#9b9890">Or copy: ${link}</p>
  `));
}

export async function sendWelcomeEmail(to, name) {
  await send(to, 'Welcome to Race Tracker!', wrap('Welcome to Race Tracker! 🎉', `
    <p>Hi <strong>${name}</strong>, your account is now active.</p>
    <p>Start adding your races and training plans!</p>
    <a href="${APP_URL}" class="btn">Go to Race Tracker</a>
  `));
}

export async function sendRaceReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  await send(to, `⏰ Tomorrow: ${race.event_name}`, wrap(`Tomorrow: ${race.event_name}!`, `
    <p>Hi <strong>${name}</strong>, tomorrow is race day!</p>
    <div class="info">
      <p><strong>${race.event_name}</strong> <span class="badge badge-race">Race</span></p>
      <p>📅 <strong>Date:</strong> ${fmtDate(race.race_date)}</p>
      ${race.flag_off_time ? `<p>🕐 <strong>Flag off:</strong> ${race.flag_off_time}</p>` : ''}
      ${race.cutoff_time   ? `<p>⏱ <strong>Cut off:</strong> ${race.cutoff_time}</p>` : ''}
      ${race.city          ? `<p>📍 <strong>Location:</strong> ${race.city}${race.country ? ', ' + race.country : ''}</p>` : ''}
      ${race.bib_number    ? `<p>🔖 <strong>Bib:</strong> #${race.bib_number}</p>` : ''}
      ${race.distance_label || race.distance_km ? `<p>🏃 <strong>Distance:</strong> ${race.distance_label || race.distance_km + ' km'}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
    <p>Good luck, ${name}! You've got this 💪</p>
  `));
}

export async function sendRpcReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  await send(to, `📦 Tomorrow: Race pack collection — ${race.event_name}`, wrap(`Race pack collection starts tomorrow`, `
    <p>Hi <strong>${name}</strong>, race pack collection for your upcoming race starts tomorrow.</p>
    <div class="info">
      <p><strong>${race.event_name}</strong> <span class="badge badge-rpc">Race Pack</span></p>
      <p>📅 <strong>Collection dates:</strong> ${fmtDate(race.rpc_date_start)}${race.rpc_date_end && race.rpc_date_end !== race.rpc_date_start ? ' – ' + fmtDate(race.rpc_date_end) : ''}</p>
      ${race.rpc_time     ? `<p>🕐 <strong>Hours:</strong> ${race.rpc_time}</p>` : ''}
      ${race.rpc_location ? `<p>📍 <strong>Location:</strong> ${race.rpc_location}</p>` : ''}
    </div>
    <a href="${link}" class="btn">View race details</a>
  `));
}

// ── Password changed notification ─────────────────────────────────────────
export async function sendPasswordChangedEmail(to, name) {
  await send(to, 'Your Race Tracker password was changed', wrap('Password changed', `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your Race Tracker password was successfully changed.</p>
    <p>If you did not make this change, please contact support immediately and change your password.</p>
    <a href="${APP_URL}" class="btn">Go to Race Tracker</a>
  `));
}

// ── Email change confirmation ─────────────────────────────────────────────
export async function sendEmailChangeConfirmation(to, name, token) {
  const link = `${APP_URL}/confirm-email?token=${encodeURIComponent(token)}`;
  await send(to, 'Confirm your new email address', wrap('Confirm new email address', `
    <p>Hi <strong>${name}</strong>,</p>
    <p>You requested to change your Race Tracker email address to <strong>${to}</strong>.</p>
    <p>Click below to confirm this change. The link expires in 24 hours.</p>
    <a href="${link}" class="btn">Confirm new email</a>
    <p style="font-size:12px;color:#9b9890">If you did not request this, ignore this email. Your current email will remain unchanged.</p>
    <p style="font-size:12px;color:#9b9890">Or copy: ${link}</p>
  `));
}

// ── Admin approval request ───────────────────────────────────────────────
export async function sendAdminApprovalRequest(adminEmail, user, approveUrl, rejectUrl) {
  await send(adminEmail, `New user awaiting approval: ${user.name}`, wrap('New account approval required', `
    <p>A new user has confirmed their email address and is awaiting your approval to access Race Tracker.</p>
    <div class="info">
      <p><strong>Name:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
    </div>
    <p>Please review and take action:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:0 8px 0 0">
          <a href="${approveUrl}" class="btn" style="background:#15803d;display:block;text-align:center">✓ Approve account</a>
        </td>
        <td style="padding:0 0 0 8px">
          <a href="${rejectUrl}" class="btn" style="background:#dc2626;display:block;text-align:center">✗ Reject &amp; delete</a>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#9b9890;margin-top:16px">Approve: ${approveUrl}<br>Reject: ${rejectUrl}</p>
  `));
}

// ── User approved notification ────────────────────────────────────────────
export async function sendAccountApproved(to, name) {
  const link = `${APP_URL}/login`;
  await send(to, 'Your Race Tracker account has been approved!', wrap('Account approved 🎉', `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Great news — an admin has approved your Race Tracker account. You can now sign in and start tracking your races!</p>
    <a href="${link}" class="btn">Sign in now</a>
    <p style="font-size:12px;color:#9b9890">If you did not register for Race Tracker, you can ignore this email.</p>
  `));
}

// ── RPC details missing reminder ─────────────────────────────────────────
export async function sendFillRpcReminder(to, name, race, daysUntil) {
  const link = `${APP_URL}/races/${race.id}`;
  const subject = `Reminder: Add race pack collection details for ${race.event_name} (${daysUntil} days away)`;
  await send(to, subject, wrap('Race pack collection details missing', `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your race <strong>${race.event_name}</strong> is only <strong>${daysUntil} day${daysUntil !== 1 ? 's' : ''} away</strong> 
       on <strong>${fmtDate(race.race_date)}</strong>, but you haven't filled in the race pack collection details yet.</p>
    <p>Make sure you know when and where to collect your race pack so you're ready on race day!</p>
    <a href="${link}" class="btn">Fill in RPC details →</a>
    <div class="info">
      <p><strong>Race:</strong> ${race.event_name}</p>
      <p><strong>Race date:</strong> ${fmtDate(race.race_date)}</p>
      ${race.city ? `<p><strong>Location:</strong> ${race.city}${race.country ? ', ' + race.country : ''}</p>` : ''}
      ${race.distance_label || race.distance_km ? `<p><strong>Distance:</strong> ${race.distance_label || race.distance_km + ' km'}</p>` : ''}
    </div>
    <p style="font-size:12px;color:#9b9890">You're receiving this because you have a race registered in Race Tracker.</p>
  `));
}

// ── Fill race results reminder ────────────────────────────────────────────
export async function sendFillResultsReminder(to, name, race) {
  const link = `${APP_URL}/races/${race.id}`;
  const subject = `How did ${race.event_name} go? Fill in your results!`;
  await send(to, subject, wrap('Fill in your race results 🏅', `
    <p>Hi <strong>${name}</strong>,</p>
    <p>It's been 3 days since <strong>${race.event_name}</strong> on <strong>${fmtDate(race.race_date)}</strong>. 
       How did it go? Your race status is still showing as <em>${race.status}</em>.</p>
    <p>Head over to Race Tracker to log your finish time, placement, and write up your race report while the memories are fresh!</p>
    <a href="${link}" class="btn">Fill in race results →</a>
    <div class="info">
      <p><strong>Race:</strong> ${race.event_name}</p>
      <p><strong>Race date:</strong> ${fmtDate(race.race_date)}</p>
      ${race.city ? `<p><strong>Location:</strong> ${race.city}${race.country ? ', ' + race.country : ''}</p>` : ''}
      ${race.distance_label || race.distance_km ? `<p><strong>Distance:</strong> ${race.distance_label || race.distance_km + ' km'}</p>` : ''}
      ${race.bib_number ? `<p><strong>Bib:</strong> #${race.bib_number}</p>` : ''}
    </div>
    <p style="font-size:12px;color:#9b9890">You're receiving this because you have a race registered in Race Tracker.</p>
  `));
}

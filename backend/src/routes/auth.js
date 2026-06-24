import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import pool from '../db/pool.js';
import { emailEnabled, sendActivationEmail, sendWelcomeEmail, sendPasswordChangedEmail, sendPasswordResetEmail, sendEmailChangeConfirmation, sendAdminApprovalRequest, sendAccountApproved, sendAccountRejected, sendPasskeyAddedEmail, sendPasskeyRemovedEmail } from '../email.js';
import { buildAuthCookie } from '../utils/authCookies.js';
import {
  pushEnabled,
  getPushPublicKey,
  upsertPushSubscription,
  setPushSubscriptionEnabled,
  deletePushSubscription,
} from '../push.js';

const router = Router();

import { requireAuth } from '../middleware/auth.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const RP_NAME = process.env.APP_NAME || 'Runholix';
const RP_ID = process.env.WEBAUTHN_RP_ID || new URL(APP_URL).hostname;
const EXPECTED_ORIGIN = process.env.WEBAUTHN_ORIGIN || APP_URL;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVATION_RESEND_COOLDOWN_MS = 60 * 1000;
const ACTIVATION_RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_CHANGE_COOLDOWN_MS = 60 * 1000;
const EMAIL_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 60 * 1000;
const authAttempts = new Map();

const STOP_REGISTRATION = process.env.STOP_REGISTRATION === 'true'

// Cleanup task: Remove expired rate-limit buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of authAttempts.entries()) {
    if (bucket.resetAt <= now) {
      authAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000); // Runs every 10 minutes

function setAuthCookie(res, token) {
  const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  res.setHeader('Set-Cookie', buildAuthCookie(token, { secure, sameSite }));
}

function clearAuthCookie(res) {
  const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  const cookie = buildAuthCookie('', { secure, sameSite });
  res.setHeader('Set-Cookie', `${cookie}; Max-Age=0`);
}

function authRateLimit(req, res, key, max = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const bucketKey = `${req.ip}:${key}`;
  const bucket = authAttempts.get(bucketKey) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    authAttempts.delete(bucketKey);
  }
  bucket.count += 1;
  authAttempts.set(bucketKey, bucket);
  if (bucket.count > max) {
    res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    return false;
  }
  return true;
}

function passwordResetPolicy(row) {
  const now = Date.now();
  const lastSentAt = row?.reset_last_sent_at ? new Date(row.reset_last_sent_at).getTime() : null;
  const windowStartAt = row?.reset_sent_window_start ? new Date(row.reset_sent_window_start).getTime() : null;
  const windowExpired = !windowStartAt || (now - windowStartAt) >= PASSWORD_RESET_WINDOW_MS;
  const sentCount = windowExpired ? 0 : Number(row?.reset_sent_count_24h || 0);
  const cooldownRemainingMs = lastSentAt ? Math.max(0, PASSWORD_RESET_COOLDOWN_MS - (now - lastSentAt)) : 0;
  const windowRemainingMs = windowExpired ? 0 : Math.max(0, PASSWORD_RESET_WINDOW_MS - (now - windowStartAt));
  return {
    cooldownSeconds: Math.ceil(cooldownRemainingMs / 1000),
    remainingResends: Math.max(0, 3 - sentCount),
    dailyLimitReached: sentCount >= 3,
    windowResetSeconds: Math.ceil(windowRemainingMs / 1000),
  };
}

function activationResendPolicy(row) {
  const now = Date.now();
  const lastSentAt = row?.activation_last_sent_at ? new Date(row.activation_last_sent_at).getTime() : null;
  const windowStartAt = row?.activation_sent_window_start ? new Date(row.activation_sent_window_start).getTime() : null;
  const windowExpired = !windowStartAt || (now - windowStartAt) >= ACTIVATION_RESEND_WINDOW_MS;
  const sentCount = windowExpired ? 0 : Number(row?.activation_sent_count_24h || 0);
  const cooldownRemainingMs = lastSentAt ? Math.max(0, ACTIVATION_RESEND_COOLDOWN_MS - (now - lastSentAt)) : 0;
  const windowRemainingMs = windowExpired ? 0 : Math.max(0, ACTIVATION_RESEND_WINDOW_MS - (now - windowStartAt));
  return {
    cooldownSeconds: Math.ceil(cooldownRemainingMs / 1000),
    remainingResends: Math.max(0, 3 - sentCount),
    dailyLimitReached: sentCount >= 3,
    windowResetSeconds: Math.ceil(windowRemainingMs / 1000),
  };
}

function emailChangePolicy(row) {
  const now = Date.now();
  const lastSentAt = row?.email_change_last_sent_at ? new Date(row.email_change_last_sent_at).getTime() : null;
  const windowStartAt = row?.email_change_sent_window_start ? new Date(row.email_change_sent_window_start).getTime() : null;
  const windowExpired = !windowStartAt || (now - windowStartAt) >= EMAIL_CHANGE_WINDOW_MS;
  const sentCount = windowExpired ? 0 : Number(row?.email_change_sent_count_24h || 0);
  const cooldownRemainingMs = lastSentAt ? Math.max(0, EMAIL_CHANGE_COOLDOWN_MS - (now - lastSentAt)) : 0;
  const windowRemainingMs = windowExpired ? 0 : Math.max(0, EMAIL_CHANGE_WINDOW_MS - (now - windowStartAt));
  return {
    cooldownSeconds: Math.ceil(cooldownRemainingMs / 1000),
    remainingResends: Math.max(0, 3 - sentCount),
    dailyLimitReached: sentCount >= 3,
    windowResetSeconds: Math.ceil(windowRemainingMs / 1000),
  };
}

function signUser(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user) {
  return { id: user.user_id || user.id, email: user.email, name: user.name, avatar_path: user.avatar_path, timezone: user.timezone };
}

async function saveChallenge({ userId = null, email = null, challenge, type }) {
  await pool.query(
    `INSERT INTO passkey_challenges (user_id, email, challenge, type, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes')`,
    [userId, email, challenge, type]
  );
}

async function consumeChallenge({ challenge, type, userId = null, email = null }) {
  const params = [challenge, type];
  let query = `DELETE FROM passkey_challenges
               WHERE challenge=$1 AND type=$2 AND expires_at > NOW()`;
  if (userId) { params.push(userId); query += ` AND user_id=$${params.length}`; }
  if (email) { params.push(email); query += ` AND email=$${params.length}`; }
  query += ' RETURNING challenge';
  const { rows } = await pool.query(query, params);
  return rows[0]?.challenge || null;
}

async function verifyCurrentPassword(userId, password) {
  if (!password) return null;
  const { rows } = await pool.query(
    'SELECT id, email, name, password_hash FROM users WHERE id=$1 AND is_active=TRUE',
    [userId]
  );
  if (!rows.length) return null;
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  return ok ? rows[0] : null;
}

// ── REGISTER ──────────────────────────────────────────────────────────────
router.get('/register', async (req, res) => {
  return res.status(200).json({ status: !STOP_REGISTRATION });
});

router.post('/register', async (req, res) => {
  if (STOP_REGISTRATION) return res.status(403).json({ error: 'Currently, the server does not accept new account registration. Contact server admin for more info.' });

  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const registerKey = `${req.ip}:register:${String(email).toLowerCase().trim()}`;
  const now_r = Date.now();
  const registerBucket = authAttempts.get(registerKey) || { count: 0, resetAt: now_r + LOGIN_FAILURE_WINDOW_MS };
  if (registerBucket.resetAt <= now_r) {
    authAttempts.delete(registerKey);
  }
  if (registerBucket.count >= LOGIN_FAILURE_LIMIT) {
    authAttempts.set(registerKey, registerBucket);
    return res.status(429).json({ error: 'Too many requests.' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);

    if (emailEnabled) {
      // Account requires email activation
      const token   = uuidv4();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, name, is_active, activation_token, activation_expires, activation_last_sent_at)
         VALUES ($1, $2, $3, FALSE, $4, $5, NOW())
        RETURNING id, email, name, timezone`,
        [email.toLowerCase().trim(), hash, name.trim(), token, expires]
      );

      await sendActivationEmail(rows[0].email, rows[0].name, token);

      return res.status(201).json({
        requiresActivation: true,
        message: 'Account created. Please check your email to activate your account.',
        cooldownSeconds: 60,
        remainingResends: 3,
        dailyLimitReached: false,
        windowResetSeconds: 24 * 60 * 60,
      });
    } else {
      // Email disabled → activate immediately
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, name, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, email, name, timezone`,
        [email.toLowerCase().trim(), hash, name.trim()]
      );
      const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      setAuthCookie(res, token);
      return res.status(201).json({ token, user: rows[0] });
    }
  } catch (err) {
    if (err.code === '23505') {
      registerBucket.count += 1;
      authAttempts.set(registerKey, registerBucket);
      if (registerBucket.count >= LOGIN_FAILURE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests.' });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────
router.post('/activate', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    if (ADMIN_EMAIL) {
      // Admin approval mode: mark email confirmed but NOT active yet
      const approvalToken = uuidv4();
      const { rows } = await pool.query(
        `UPDATE users
         SET activation_token = NULL, activation_expires = NULL,
             pending_approval = TRUE, approval_token = $1
         WHERE activation_token = $2
           AND activation_expires > NOW()
           AND is_active = FALSE
         RETURNING id, email, name, timezone`,
        [approvalToken, token]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'Invalid or expired activation link. Please register again.' });
      }
      const user = rows[0];
      const reviewUrl = `${APP_URL}/admin-approve?token=${approvalToken}`;
      sendAdminApprovalRequest(ADMIN_EMAIL, user, reviewUrl).catch(() => {});
      return res.json({
        requiresApproval: true,
        message: 'Email confirmed! Your account is now awaiting admin approval. You will receive an email once approved.',
      });
    } else {
      // No admin — activate immediately
      const { rows } = await pool.query(
        `UPDATE users
         SET is_active = TRUE, activation_token = NULL, activation_expires = NULL
         WHERE activation_token = $1
           AND activation_expires > NOW()
           AND is_active = FALSE
         RETURNING id, email, name, timezone`,
        [token]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'Invalid or expired activation link. Please register again.' });
      }
      sendWelcomeEmail(rows[0].email, rows[0].name).catch(() => {});
      const jwt_token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      setAuthCookie(res, jwt_token);
      res.json({ token: jwt_token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name, timezone: rows[0].timezone } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ADMIN APPROVE / REJECT ────────────────────────────────────────────────
// Review page submits decision and optional message from the frontend.
router.get('/admin-approve', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(404).json({ error: 'Not found.' });
  if (!ADMIN_EMAIL) return res.status(404).json({ error: 'Not found.' });

  try {
    const { rows } = await pool.query(
      `SELECT name, email
       FROM users
       WHERE approval_token = $1 AND pending_approval = TRUE
       LIMIT 1`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.post('/admin-approve', async (req, res) => {
  const { token, action, message } = req.body || {};
  if (!token || !['approve', 'reject'].includes(action)) {
    return res.status(404).json({ error: 'Not found.' });
  }
  if (!ADMIN_EMAIL) return res.status(404).json({ error: 'Not found.' });

  try {
    if (action === 'approve') {
      const { rows } = await pool.query(
        `UPDATE users
         SET is_active = TRUE, pending_approval = FALSE, approval_token = NULL
         WHERE approval_token = $1 AND pending_approval = TRUE
         RETURNING id, email, name, timezone`,
        [token]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found.' });
      sendWelcomeEmail(rows[0].email, rows[0].name).catch(() => {});
      sendAccountApproved(rows[0].email, rows[0].name, message || '').catch(() => {});
      return res.json({
        message: 'Account approved and notification email sent.',
        user: { name: rows[0].name, email: rows[0].email },
      });
    }

    const { rows } = await pool.query(
      `DELETE FROM users WHERE approval_token = $1 AND pending_approval = TRUE
       RETURNING name, email`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    if (String(message || '').trim()) {
      sendAccountRejected(rows[0].email, rows[0].name, message).catch(() => {});
    }
    return res.json({
      message: String(message || '').trim() ? 'Account rejected and notification email sent.' : 'Account rejected.',
      user: { name: rows[0].name, email: rows[0].email },
      notified: Boolean(String(message || '').trim()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── RESEND ACTIVATION ─────────────────────────────────────────────────────
router.post('/resend-activation', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const normalizedEmail = email.toLowerCase().trim();
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: users } = await client.query(
      `SELECT id, email, name, is_active, activation_last_sent_at, activation_sent_count_24h, activation_sent_window_start
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [normalizedEmail]
    );
    const user = users[0];
    if (!user || user.is_active) {
      await client.query('COMMIT');
      return res.json({ message: 'If that email exists and is unactivated, a new link has been sent.' });
    }

    const policy = activationResendPolicy(user);
    if (policy.dailyLimitReached || policy.cooldownSeconds > 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: policy.dailyLimitReached
          ? 'Activation email resend limit reached for today. Please try again later.'
          : 'Please wait before requesting another activation email.',
        ...policy,
      });
    }

    const newToken   = uuidv4();
    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const { rows } = await client.query(
      `UPDATE users
       SET activation_token = $1,
           activation_expires = $2,
           activation_last_sent_at = $3,
           activation_sent_count_24h = CASE
             WHEN activation_sent_window_start IS NULL OR activation_sent_window_start <= NOW() - INTERVAL '24 hours' THEN 1
             ELSE COALESCE(activation_sent_count_24h, 0) + 1
           END,
           activation_sent_window_start = CASE
             WHEN activation_sent_window_start IS NULL OR activation_sent_window_start <= NOW() - INTERVAL '24 hours' THEN $3
             ELSE activation_sent_window_start
           END
       WHERE id = $4 AND is_active = FALSE
       RETURNING email, name`,
      [newToken, newExpires, now, user.id]
    );
    await client.query('COMMIT');
    // Always respond the same to avoid email enumeration
    if (rows.length) {
      await sendActivationEmail(rows[0].email, rows[0].name, newToken);
    }
    res.json({
      message: 'If that email exists and is unactivated, a new link has been sent.',
      cooldownSeconds: 60,
      remainingResends: Math.max(0, policy.remainingResends - 1),
      dailyLimitReached: policy.remainingResends - 1 <= 0,
      windowResetSeconds: policy.windowResetSeconds || 24 * 60 * 60,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors from already-closed transactions.
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client?.release();
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
// ── FORGOT PASSWORD ────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, is_active, reset_last_sent_at, reset_sent_count_24h, reset_sent_window_start
       FROM users
       WHERE email = $1`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.json({ message: 'If that email exists, a password reset link has been sent.' });
    }

    const policy = passwordResetPolicy(user);
    if (policy.dailyLimitReached || policy.cooldownSeconds > 0) {
      return res.status(429).json({
        error: policy.dailyLimitReached
          ? 'Password reset limit reached for today. Please try again later.'
          : 'Please wait before requesting another password reset email.',
        ...policy,
      });
    }

    const token = uuidv4();
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    const now = new Date();
    await pool.query(
      `UPDATE users
       SET reset_token = $1,
           reset_expires = $2,
           reset_last_sent_at = $3,
           reset_sent_count_24h = CASE
             WHEN reset_sent_window_start IS NULL OR reset_sent_window_start <= NOW() - INTERVAL '24 hours' THEN 1
             ELSE COALESCE(reset_sent_count_24h, 0) + 1
           END,
           reset_sent_window_start = CASE
             WHEN reset_sent_window_start IS NULL OR reset_sent_window_start <= NOW() - INTERVAL '24 hours' THEN $3
             ELSE reset_sent_window_start
           END
       WHERE id = $4`,
      [token, expires, now, user.id]
    );
    await sendPasswordResetEmail(user.email, user.name, token);
    res.json({
      message: 'If that email exists, a password reset link has been sent.',
      cooldownSeconds: 60,
      remainingResends: Math.max(0, 3 - (Number(user.reset_sent_count_24h || 0) + 1)),
      dailyLimitReached: Number(user.reset_sent_count_24h || 0) + 1 >= 3,
      windowResetSeconds: 24 * 60 * 60,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forgot-password/confirm', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: 'token and new_password are required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name
       FROM users
       WHERE reset_token = $1
         AND reset_expires > NOW()
         AND is_active = TRUE`,
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    const user = rows[0];
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_expires = NULL,
           reset_last_sent_at = NULL,
           reset_sent_count_24h = 0,
           reset_sent_window_start = NULL
       WHERE id = $2`,
      [hash, user.id]
    );
    sendPasswordChangedEmail(user.email, user.name).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const normalizedEmail = email.toLowerCase().trim();
  const loginKey = `${req.ip}:login:${normalizedEmail}`;
  const now = Date.now();
  const bucket = authAttempts.get(loginKey) || { count: 0, resetAt: now + LOGIN_FAILURE_WINDOW_MS };
  if (bucket.resetAt <= now) {
    authAttempts.delete(loginKey);
  }
  if (bucket.count >= LOGIN_FAILURE_LIMIT) {
    authAttempts.set(loginKey, bucket);
    return res.status(429).json({ error: 'Too many requests.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, password_hash, avatar_path, timezone, is_active FROM users WHERE email = $1',
      [normalizedEmail]
    );
    if (!rows.length) {
      bucket.count += 1;
      authAttempts.set(loginKey, bucket);
      if (bucket.count >= LOGIN_FAILURE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests.' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) {
      bucket.count += 1;
      authAttempts.set(loginKey, bucket);
      if (bucket.count >= LOGIN_FAILURE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests.' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    authAttempts.delete(loginKey);
    if (!rows[0].is_active) {
      return res.status(403).json({
        error: 'Account not activated. Please check your email.',
        requiresActivation: true,
      });
    }
    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    setAuthCookie(res, token);
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name, avatar_path: rows[0].avatar_path, timezone: rows[0].timezone } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.post('/passkeys/login/options', async (req, res) => {
  if (!authRateLimit(req, res, 'passkey-options', 12)) return;
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: [],
      userVerification: 'required',
    });
    await saveChallenge({ challenge: options.challenge, type: 'authentication' });
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/passkeys/login/verify', async (req, res) => {
  const credential = req.body.credential;
  if (!credential) return res.status(400).json({ error: 'Credential required' });
  if (!authRateLimit(req, res, 'passkey-verify', 8)) return;
  try {
    const clientData = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf8'));
    const { rows } = await pool.query(
      `SELECT p.*, u.id AS user_id, u.email, u.name, u.avatar_path, u.is_active
       FROM passkeys p
       JOIN users u ON u.id = p.user_id
       WHERE p.credential_id=$1`,
      [credential.id]
    );
    if (!rows.length || !rows[0].is_active) return res.status(401).json({ error: 'Invalid passkey' });
    const passkey = rows[0];
    const expectedChallenge = await consumeChallenge({ challenge: clientData.challenge, type: 'authentication' });
    if (!expectedChallenge) return res.status(400).json({ error: 'Invalid or expired passkey challenge' });

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: isoBase64URL.toBuffer(passkey.public_key),
        counter: Number(passkey.counter),
        transports: passkey.transports || [],
      },
    });
    if (!verification.verified) return res.status(401).json({ error: 'Passkey verification failed' });

    await pool.query(
      'UPDATE passkeys SET counter=$1, last_used_at=NOW() WHERE id=$2',
      [verification.authenticationInfo.newCounter, passkey.id]
    );
    const user = publicUser(passkey);
    const token = signUser(user);
    setAuthCookie(res, token);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ME ────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.headers.cookie?.match(/(?:^|;\s*)rt_token=([^;]+)/)?.[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    const { rows } = await pool.query(
    'SELECT id, email, name, avatar_path, timezone FROM users WHERE id = $1 AND is_active = TRUE',
      [payload.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;

// ── UPDATE NAME ───────────────────────────────────────────────────────────
router.put('/name', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE users SET name=$1 WHERE id=$2 RETURNING id, email, name',
      [name.trim(), req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/timezone', requireAuth, async (req, res) => {
  const timezone = String(req.body.timezone || '').trim();
  if (!timezone) return res.status(400).json({ error: 'Timezone is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE users SET timezone=$1 WHERE id=$2 RETURNING id, email, name, avatar_path, timezone',
      [timezone, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE id=$1',
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.userId]);

    // Notify via email (non-blocking)
    sendPasswordChangedEmail(rows[0].email, rows[0].name).catch(() => {});

    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/passkeys', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, created_at, last_used_at
       FROM passkeys
       WHERE user_id=$1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/passkeys/register/options', requireAuth, async (req, res) => {
  const currentPassword = req.body.current_password;
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
  try {
    const user = await verifyCurrentPassword(req.userId, currentPassword);
    if (!user) return res.status(401).json({ error: 'Current password is incorrect' });

    const { rows: passkeys } = await pool.query(
      'SELECT credential_id, transports FROM passkeys WHERE user_id=$1 ORDER BY created_at DESC',
      [req.userId]
    );
    if (passkeys.length >= 3) return res.status(400).json({ error: 'You can register up to 3 passkeys.' });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email,
      userDisplayName: user.name,
      excludeCredentials: passkeys.map(p => ({ id: p.credential_id, transports: p.transports || [] })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      attestationType: 'none',
    });
    await saveChallenge({ userId: req.userId, challenge: options.challenge, type: 'registration' });
    res.json(options);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/passkeys/register/verify', requireAuth, async (req, res) => {
  const credential = req.body.credential;
  const requestedName = String(req.body.name || '').trim();
  if (!credential) return res.status(400).json({ error: 'Credential required' });
  try {
    const clientData = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf8'));
    const { rows: users } = await pool.query('SELECT id, email, name FROM users WHERE id=$1', [req.userId]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS count FROM passkeys WHERE user_id=$1', [req.userId]);
    if (countRows[0].count >= 3) return res.status(400).json({ error: 'You can register up to 3 passkeys.' });
    const expectedChallenge = await consumeChallenge({ userId: req.userId, challenge: clientData.challenge, type: 'registration' });
    if (!expectedChallenge) return res.status(400).json({ error: 'Invalid or expired passkey challenge' });

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration failed' });
    }

    const { credential: registeredCredential } = verification.registrationInfo;
    const passkeyName = requestedName || 'Passkey';
    const { rows } = await pool.query(
      `INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, transports)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, created_at, last_used_at`,
      [
        req.userId,
        registeredCredential.id,
        isoBase64URL.fromBuffer(registeredCredential.publicKey),
        registeredCredential.counter || 0,
        passkeyName,
        registeredCredential.transports || credential.response.transports || [],
      ]
    );
    sendPasskeyAddedEmail(users[0].email, users[0].name, passkeyName).catch(() => {});
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This passkey is already registered.' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/passkeys/:id', requireAuth, async (req, res) => {
  const user = await verifyCurrentPassword(req.userId, req.body.current_password);
  if (!user) return res.status(401).json({ error: 'Current password is incorrect' });
  try {
    const { rows } = await pool.query(
      `DELETE FROM passkeys p
       USING users u
       WHERE p.id=$1 AND p.user_id=$2 AND u.id=p.user_id
       RETURNING p.name, u.email, u.name AS user_name`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Passkey not found' });
    sendPasskeyRemovedEmail(rows[0].email, rows[0].user_name, rows[0].name).catch(() => {});
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── REQUEST EMAIL CHANGE ──────────────────────────────────────────────────
// Stores the pending new email + sends confirmation to new address
router.put('/email', requireAuth, async (req, res) => {
  const { new_email, password } = req.body;
  if (!new_email || !password)
    return res.status(400).json({ error: 'new_email and password are required' });

  const normalized = new_email.toLowerCase().trim();
  const emailKey = `${req.ip}:email-change:${req.userId}`;
  const now_e = Date.now();
  const emailBucket = authAttempts.get(emailKey) || { count: 0, resetAt: now_e + LOGIN_FAILURE_WINDOW_MS };
  if (emailBucket.resetAt <= now_e) {
    authAttempts.delete(emailBucket);
  }
  if (emailBucket.count >= LOGIN_FAILURE_LIMIT) {
    authAttempts.set(emailKey, emailBucket);
    return res.status(429).json({ error: 'Too many requests.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, email, name, password_hash FROM users WHERE id=$1 FOR UPDATE',
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    // Verify password
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) {
      emailBucket.count += 1;
      authAttempts.set(emailKey, emailBucket);
      if (emailBucket.count >= LOGIN_FAILURE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests.' });
      }
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Check new email not already taken
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email=$1 AND id!=$2', [normalized, req.userId]
    );
    if (existing.length) {
      emailBucket.count += 1;
      authAttempts.set(emailKey, emailBucket);
      if (emailBucket.count >= LOGIN_FAILURE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests.' });
      }
      return res.status(409).json({ error: 'Email already in use' });
    }

    if (normalized === rows[0].email)
      return res.status(400).json({ error: 'New email is the same as current email' });

    const policy = emailChangePolicy(rows[0]);
    if (policy.dailyLimitReached || policy.cooldownSeconds > 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: policy.dailyLimitReached
          ? 'Email change limit reached for today. Please try again later.'
          : 'Please wait before requesting another email change confirmation.',
        ...policy,
      });
    }

    const token   = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    await client.query(
      `UPDATE users
       SET pending_email=$1,
           email_change_token=$2,
           email_change_expires=$3,
           email_change_last_sent_at=$4,
           email_change_sent_count_24h = CASE
             WHEN email_change_sent_window_start IS NULL OR email_change_sent_window_start <= NOW() - INTERVAL '24 hours' THEN 1
             ELSE COALESCE(email_change_sent_count_24h, 0) + 1
           END,
           email_change_sent_window_start = CASE
             WHEN email_change_sent_window_start IS NULL OR email_change_sent_window_start <= NOW() - INTERVAL '24 hours' THEN $4
             ELSE email_change_sent_window_start
           END
       WHERE id=$5`,
      [normalized, token, expires, now, req.userId]
    );

    if (emailEnabled) {
      await sendEmailChangeConfirmation(normalized, rows[0].name, token);
      await client.query('COMMIT');
      res.json({
        message: `Confirmation email sent to ${normalized}. Click the link to confirm.`,
        cooldownSeconds: 60,
        remainingResends: Math.max(0, policy.remainingResends - 1),
        dailyLimitReached: policy.remainingResends - 1 <= 0,
        windowResetSeconds: policy.windowResetSeconds || 24 * 60 * 60,
      });
    } else {
      // Email disabled — apply immediately
      await client.query(
        'UPDATE users SET email=$1, pending_email=NULL, email_change_token=NULL, email_change_expires=NULL WHERE id=$2',
        [normalized, req.userId]
      );
      await client.query('COMMIT');
      res.json({ message: 'Email updated (email confirmation disabled).', email: normalized });
    }
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client?.release();
  }
});

// Get email reminder status
router.get('/email-reminder', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
        'SELECT email_reminder_enabled FROM users WHERE id=$1',
        [req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ enabled: rows[0].email_reminder_enabled || false });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// enable/disable email reminder
router.put('/email-reminder', requireAuth, async (req, res) => {
  const { action } = req.body; // 'enable' | 'disable'
  if (!['enable', 'disable'].includes(action))
    return res.status(400).json({ error: 'action must be enable or disable' });

  try {
    if (action === 'disable') {
      await pool.query(
          'UPDATE users SET email_reminder_enabled=FALSE WHERE id=$1',
          [req.userId]
      );
      return res.json({ enabled: false });
    } else {
      await pool.query(
          'UPDATE users SET email_reminder_enabled=TRUE WHERE id=$1',
          [req.userId]
      );
      return res.json({ enabled: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/push-notification', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
        'SELECT endpoint, is_enabled, device_name FROM push_subscriptions WHERE user_id=$1 ORDER BY updated_at DESC',
        [req.userId]
    );

    res.json({
      devices: rows, // Array of { endpoint, is_enabled }
      activeDevicesCount: rows.filter(d => d.is_enabled).length,
      configured: pushEnabled,
      publicKey: getPushPublicKey(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/push-notification', requireAuth, async (req, res) => {
  const { action, subscription, endpoint, deviceName } = req.body;
  if (!['enable', 'disable', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'action must be enable, disable, or delete' });
  }

  try {
    if (action === 'enable') {
      if (!pushEnabled) {
        return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
      }
      if (!subscription?.endpoint) {
        return res.status(400).json({ error: 'Push subscription is required to enable notifications.' });
      }
      await upsertPushSubscription(req.userId, subscription, deviceName || null);
      return res.json({ enabled: true, message: 'Device enabled successfully' });
    }

    if (action === 'disable') {
      if (!endpoint) return res.status(400).json({ error: 'Endpoint is required to disable a device.' });
      await setPushSubscriptionEnabled(req.userId, endpoint, false);
      return res.json({ enabled: false, message: 'Device disabled successfully' });
    }

    if (action === 'delete') {
      if (!endpoint) return res.status(400).json({ error: 'Endpoint is required to delete a device.' });
      await deletePushSubscription(req.userId, endpoint);
      return res.json({ deleted: true, message: 'Device registration removed' });
    }
  } catch (err) {
    console.error(err);
    const status = err.message.includes('Maximum of 3') ? 409 : 500;
    res.status(status).json({ error: err.message || 'Server error' });
  }
});

// ── CONFIRM EMAIL CHANGE ──────────────────────────────────────────────────
router.post('/confirm-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET email=pending_email, pending_email=NULL,
           email_change_token=NULL, email_change_expires=NULL
       WHERE email_change_token=$1
         AND email_change_expires > NOW()
         AND pending_email IS NOT NULL
       RETURNING id, email, name, timezone`,
      [token]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'Invalid or expired confirmation link.' });
    // Return fresh JWT with updated email
    const jwt_token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    setAuthCookie(res, jwt_token);
    res.json({ token: jwt_token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name, timezone: rows[0].timezone } });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already in use' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// ── CALENDAR FEED SETTINGS ────────────────────────────────────────────────
// GET /api/auth/ical  — returns ical_enabled + masked URL for display
router.get('/ical', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT ical_enabled, ical_token FROM users WHERE id=$1',
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const { ical_enabled, ical_token } = rows[0];
    const appUrl = process.env.APP_URL || '';
    const feedUrl = ical_token ? `${appUrl}/ical/${ical_token}.ics` : null;
    res.json({ ical_enabled: ical_enabled || false, feed_url: feedUrl });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/auth/ical  — enable/disable feed, or regenerate token
router.put('/ical', requireAuth, async (req, res) => {
  const { action } = req.body; // 'enable' | 'disable' | 'regenerate'
  if (!['enable', 'disable', 'regenerate'].includes(action))
    return res.status(400).json({ error: 'action must be enable, disable, or regenerate' });

  try {
    let token;
    if (action === 'disable') {
      await pool.query(
        'UPDATE users SET ical_enabled=FALSE WHERE id=$1',
        [req.userId]
      );
      return res.json({ ical_enabled: false, feed_url: null });
    }

    // enable or regenerate — always generate a fresh secure token
    const { rows: tokenRows } = await pool.query(
      `UPDATE users
       SET ical_enabled=TRUE,
           ical_token=encode(gen_random_bytes(32), 'hex')
       WHERE id=$1
       RETURNING ical_token`,
      [req.userId]
    );
    token = tokenRows[0].ical_token;
    const appUrl = process.env.APP_URL || '';
    const feedUrl = `${appUrl}/ical/${token}.ics`;
    res.json({ ical_enabled: true, feed_url: feedUrl });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

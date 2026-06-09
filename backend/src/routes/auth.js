import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { emailEnabled, sendActivationEmail, sendWelcomeEmail, sendPasswordChangedEmail, sendEmailChangeConfirmation } from '../email.js';

const router = Router();

import { requireAuth } from '../middleware/auth.js';

// ── REGISTER ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);

    if (emailEnabled) {
      // Account requires email activation
      const token   = uuidv4();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, name, is_active, activation_token, activation_expires)
         VALUES ($1, $2, $3, FALSE, $4, $5)
         RETURNING id, email, name`,
        [email.toLowerCase().trim(), hash, name.trim(), token, expires]
      );

      await sendActivationEmail(rows[0].email, rows[0].name, token);

      return res.status(201).json({
        requiresActivation: true,
        message: 'Account created. Please check your email to activate your account.',
      });
    } else {
      // Email disabled → activate immediately
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, name, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, email, name`,
        [email.toLowerCase().trim(), hash, name.trim()]
      );
      const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return res.status(201).json({ token, user: rows[0] });
    }
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────
router.post('/activate', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET is_active = TRUE, activation_token = NULL, activation_expires = NULL
       WHERE activation_token = $1
         AND activation_expires > NOW()
         AND is_active = FALSE
       RETURNING id, email, name`,
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired activation link. Please register again.' });
    }
    // Send welcome email (non-blocking)
    sendWelcomeEmail(rows[0].email, rows[0].name).catch(() => {});
    // Return JWT so user is logged in immediately after activation
    const jwt_token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: jwt_token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── RESEND ACTIVATION ─────────────────────────────────────────────────────
router.post('/resend-activation', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const newToken   = uuidv4();
    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { rows } = await pool.query(
      `UPDATE users
       SET activation_token = $1, activation_expires = $2
       WHERE email = $3 AND is_active = FALSE
       RETURNING email, name`,
      [newToken, newExpires, email.toLowerCase().trim()]
    );
    // Always respond the same to avoid email enumeration
    if (rows.length) {
      await sendActivationEmail(rows[0].email, rows[0].name, newToken);
    }
    res.json({ message: 'If that email exists and is unactivated, a new link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    if (!rows[0].is_active) {
      return res.status(403).json({
        error: 'Account not activated. Please check your email.',
        requiresActivation: true,
      });
    }
    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── ME ────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1 AND is_active = TRUE',
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

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
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

// ── REQUEST EMAIL CHANGE ──────────────────────────────────────────────────
// Stores the pending new email + sends confirmation to new address
router.put('/email', requireAuth, async (req, res) => {
  const { new_email, password } = req.body;
  if (!new_email || !password)
    return res.status(400).json({ error: 'new_email and password are required' });

  const normalized = new_email.toLowerCase().trim();
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    // Verify password
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Password is incorrect' });

    // Check new email not already taken
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email=$1 AND id!=$2', [normalized, req.userId]
    );
    if (existing.length) return res.status(409).json({ error: 'Email already in use' });

    if (normalized === rows[0].email)
      return res.status(400).json({ error: 'New email is the same as current email' });

    const token   = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE users SET pending_email=$1, email_change_token=$2, email_change_expires=$3 WHERE id=$4',
      [normalized, token, expires, req.userId]
    );

    if (emailEnabled) {
      await sendEmailChangeConfirmation(normalized, rows[0].name, token);
      res.json({ message: `Confirmation email sent to ${normalized}. Click the link to confirm.` });
    } else {
      // Email disabled — apply immediately
      await pool.query(
        'UPDATE users SET email=$1, pending_email=NULL, email_change_token=NULL, email_change_expires=NULL WHERE id=$2',
        [normalized, req.userId]
      );
      res.json({ message: 'Email updated (email confirmation disabled).', email: normalized });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
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
       RETURNING id, email, name`,
      [token]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'Invalid or expired confirmation link.' });
    // Return fresh JWT with updated email
    const jwt_token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: jwt_token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already in use' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

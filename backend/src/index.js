import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import authRoutes from './routes/auth.js';
import racesRoutes from './routes/races.js';
import uploadRoutes from './routes/upload.js';
import trainingRoutes from './routes/training.js';
import icalRoutes from './routes/ical.js';
import { startScheduler } from './scheduler.js';
import migrate from "./db/migrate.js";
import jwt from 'jsonwebtoken';
import { getAuthToken, signCsrfToken, verifyCsrfToken } from './utils/authCookies.js';
import webpush from 'web-push';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigin = (process.env.CORS_ORIGIN || '').trim();
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'change-me';
const csrfAllowedPublicPrefixes = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/activate',
  '/api/auth/resend-activation',
  '/api/auth/forgot-password',
  '/api/auth/forgot-password/confirm',
  '/api/auth/admin-approve',
  '/api/auth/passkeys/login/options',
  '/api/auth/passkeys/login/verify',
  '/api/auth/passkeys/register/options',
  '/api/auth/passkeys/register/verify',
];

const corsOptions = corsOrigin
  ? {
      origin: corsOrigin.includes(',')
        ? corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean)
        : corsOrigin,
      credentials: true,
    }
  : { credentials: true };

app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/auth/csrf', (req, res) => {
  const authToken = getAuthToken(req);
  if (!authToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(authToken, process.env.JWT_SECRET);
    const csrfToken = signCsrfToken(String(payload.userId), CSRF_SECRET);
    res.json({ csrfToken });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
  if (csrfAllowedPublicPrefixes.some(prefix => req.path.startsWith(prefix))) return next();

  const token = req.headers['x-csrf-token'];
  const authToken = getAuthToken(req);
  let stableId = null;
  try {
    const payload = jwt.verify(authToken, process.env.JWT_SECRET);
    stableId = String(payload.userId);
  } catch { /* verifyCsrfToken will fail safely below */ }
  if (!verifyCsrfToken(token, stableId, CSRF_SECRET)) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  next();
});

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: 'connected' }); }
  catch { res.status(503).json({ ok: false, db: 'disconnected' }); }
});

app.use('/api/auth', authRoutes);
app.use('/api/races', racesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/training', trainingRoutes);
app.use('/ical', icalRoutes);

migrate()
  .then(() => {
    startScheduler();
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));

    try {
      webpush.setVapidDetails(
          process.env.VAPID_SUBJECT,
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
      );

      console.log('VAPID loaded OK');
    } catch (err) {
      console.error(err);
    }
  })
  .catch(err => {
    console.error('Startup failed:', err); process.exit(1);
  });

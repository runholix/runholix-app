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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
  })
  .catch(err => {
    console.error('Startup failed:', err); process.exit(1);
  });

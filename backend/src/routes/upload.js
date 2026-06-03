import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Multer: save to /uploads/<userId>/<uuid><ext> ─────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.userId);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function routeFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.fit', '.gpx', '.kml'].includes(ext)) return cb(null, true);
  cb(new Error('Only .fit, .gpx, .kml files are accepted for route uploads'));
}

const routeUpload = multer({
  storage,
  fileFilter: routeFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

function pdfFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return cb(null, true);
  cb(new Error('Only PDF files are accepted for attachments'));
}

const pdfUpload = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ── POST /api/upload/route ─────────────────────────────────────────────────
// Accepts .fit / .gpx / .kml — stores on disk, returns path + name
router.post('/route', requireAuth, routeUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    route_file_path: `/${req.userId}/${req.file.filename}`,
    route_file_name: req.file.originalname,
  });
});

// ── GET /api/upload/route-file/:userId/:filename ───────────────────────────
// Serves the stored route file (download)
// Support token in query param for direct link access (download link in <a href>)
router.get('/route-file/:userId/:filename', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const filePath = path.join(UPLOAD_DIR, req.params.userId, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  // Force download with original name stored in DB (passed as query param)
  const name = req.query.name || req.params.filename;
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.sendFile(path.resolve(filePath));
});

// ── DELETE /api/upload/route-file/:userId/:filename ───────────────────────
router.delete('/route-file/:userId/:filename', requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const filePath = path.join(UPLOAD_DIR, req.params.userId, req.params.filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete file' });
  }
});

// ── POST /api/upload/attachment  — PDF only ───────────────────────────────
router.post('/attachment', requireAuth, pdfUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    attachment_path: `/${req.userId}/${req.file.filename}`,
    attachment_name: req.file.originalname,
  });
});

// ── GET /api/upload/attachment/:userId/:filename ───────────────────────────
// Serves PDF inline so the browser renders it without downloading
router.get('/attachment/:userId/:filename', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const filePath = path.join(UPLOAD_DIR, req.params.userId, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(path.resolve(filePath));
});

// ── DELETE /api/upload/attachment/:userId/:filename ───────────────────────
router.delete('/attachment/:userId/:filename', requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const filePath = path.join(UPLOAD_DIR, req.params.userId, req.params.filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not delete file' });
  }
});

export default router;

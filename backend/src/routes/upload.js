import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

// ── File size limits ──────────────────────────────────────────────────────
const PDF_MAX_BYTES    = 10 * 1024 * 1024;           // 10 MB hard
const ROUTE_HARD_MAX   = 100 * 1024 * 1024;          // 100 MB absolute ceiling
const ROUTE_BASE_BYTES = 5 * 1024 * 1024;            // 5 MB for ≤ 10 km / undefined
const ROUTE_PER_KM     = 0.6 * 1024 * 1024;         // 0.6 MB per km

/** Compute allowed bytes for a route/result file given optional distance_km */
function routeLimitBytes(distanceKm) {
  const km = parseFloat(distanceKm);
  if (!km || km <= 10) return ROUTE_BASE_BYTES;
  const calculated = Math.ceil(km * ROUTE_PER_KM);
  return Math.min(calculated, ROUTE_HARD_MAX);
}

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

// ── Filename sanitisation ─────────────────────────────────────────────────
/** Strip path traversal, null bytes, and non-ASCII cruft; keep ext. */
function sanitiseOriginalName(raw) {
  // Remove any directory component
  const base = path.basename(raw)
    .replace(/\0/g, '')                    // null bytes
    .replace(/[/\\:*?"<>|]/g, '_')         // reserved characters
    .replace(/\s+/g, '_')                  // whitespace → underscore
    .replace(/\.{2,}/g, '.')               // collapse multiple dots
    .slice(0, 200);                         // cap length
  // Ensure it still has a safe extension
  return base || 'upload';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Multer storage: UUID filenames, user subdirectory ─────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // req.userId is set by requireAuth — never user-supplied
    const dir = path.join(UPLOAD_DIR, req.userId);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Stored name is always <uuid><ext> — no user-supplied name on disk
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.fit', '.gpx', '.kml', '.pdf'].includes(ext) ? ext : '';
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

// ── Route/result file filter (.fit / .gpx / .kml) ────────────────────────
function routeFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.fit', '.gpx', '.kml'].includes(ext)) return cb(null, true);
  cb(Object.assign(new Error('Only .fit, .gpx, .kml files are accepted'), { code: 'BAD_TYPE' }));
}

// Use the absolute ceiling for multer; the per-distance check happens after
const routeMulter = multer({ storage, fileFilter: routeFileFilter, limits: { fileSize: ROUTE_HARD_MAX } });

// ── PDF filter ────────────────────────────────────────────────────────────
function pdfFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return cb(null, true);
  cb(Object.assign(new Error('Only PDF files are accepted'), { code: 'BAD_TYPE' }));
}

const pdfMulter = multer({ storage, fileFilter: pdfFileFilter, limits: { fileSize: PDF_MAX_BYTES } });

// ── Multer error handler ──────────────────────────────────────────────────
function handleMulterError(err, res) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum allowed: ${formatMB(err.field === 'pdf' ? PDF_MAX_BYTES : ROUTE_HARD_MAX)}` });
  }
  if (err.code === 'BAD_TYPE') {
    return res.status(415).json({ error: err.message });
  }
  return res.status(400).json({ error: err.message || 'Upload error' });
}

// ── Validate stored file path is inside UPLOAD_DIR (path traversal guard) ─
function safeFilePath(userId, filename) {
  // userId comes from JWT (trusted), filename is UUID+ext (from our storage fn)
  // Still validate to ensure no surprises
  const resolved = path.resolve(path.join(UPLOAD_DIR, userId, filename));
  const base     = path.resolve(UPLOAD_DIR);
  if (!resolved.startsWith(base + path.sep)) return null; // traversal attempt
  return resolved;
}

// ── POST /api/upload/route ────────────────────────────────────────────────
router.post('/route', requireAuth, (req, res) => {
  routeMulter.single('file')(req, res, err => {
    if (err) return handleMulterError(err, res);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Per-distance size check
    const distKm = parseFloat(req.query.distance_km) || 0;
    const limit  = routeLimitBytes(distKm);
    if (req.file.size > limit) {
      fs.unlinkSync(req.file.path); // delete the already-stored file
      return res.status(413).json({
        error: `File too large for a ${distKm > 0 ? distKm + ' km' : 'undefined distance'} race. Maximum: ${formatMB(limit)}`,
      });
    }

    res.json({
      route_file_path: `/${req.userId}/${req.file.filename}`,
      route_file_name: sanitiseOriginalName(req.file.originalname),
    });
  });
});

// ── POST /api/upload/result ───────────────────────────────────────────────
router.post('/result', requireAuth, (req, res) => {
  routeMulter.single('file')(req, res, async err => {
    if (err) return handleMulterError(err, res);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const distKm = parseFloat(req.query.distance_km) || 0;
    const limit  = routeLimitBytes(distKm);
    if (req.file.size > limit) {
      fs.unlinkSync(req.file.path);
      return res.status(413).json({
        error: `File too large for a ${distKm > 0 ? distKm + ' km' : 'undefined distance'} race. Maximum: ${formatMB(limit)}`,
      });
    }

    res.json({
      result_file_path: `/${req.userId}/${req.file.filename}`,
      result_file_name: sanitiseOriginalName(req.file.originalname),
    });
  });
});

// ── GET /api/upload/route-file/:userId/:filename ──────────────────────────
router.get('/route-file/:userId/:filename', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const filePath = safeFilePath(req.params.userId, req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const displayName = sanitiseOriginalName(req.query.name || req.params.filename);
  res.setHeader('Content-Disposition', `attachment; filename="${displayName}"`);
  res.sendFile(filePath);
});

// ── DELETE /api/upload/route-file/:userId/:filename ───────────────────────
router.delete('/route-file/:userId/:filename', requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const filePath = safeFilePath(req.params.userId, req.params.filename);
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not delete file' });
  }
});

// ── POST /api/upload/attachment ───────────────────────────────────────────
router.post('/attachment', requireAuth, (req, res) => {
  pdfMulter.single('file')(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `PDF too large. Maximum: ${formatMB(PDF_MAX_BYTES)}` });
      }
      return handleMulterError(err, res);
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
      attachment_path: `/${req.userId}/${req.file.filename}`,
      attachment_name: sanitiseOriginalName(req.file.originalname),
    });
  });
});

// ── GET /api/upload/attachment/:userId/:filename ──────────────────────────
router.get('/attachment/:userId/:filename', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  next();
}, requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const filePath = safeFilePath(req.params.userId, req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Content-Type', 'application/pdf');
  if (req.query.download === '1') {
    const displayName = sanitiseOriginalName(req.query.name || req.params.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${displayName}"`);
  } else {
    res.setHeader('Content-Disposition', 'inline');
  }
  res.sendFile(filePath);
});

// ── DELETE /api/upload/attachment/:userId/:filename ───────────────────────
router.delete('/attachment/:userId/:filename', requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const filePath = safeFilePath(req.params.userId, req.params.filename);
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not delete file' });
  }
});

export default router;

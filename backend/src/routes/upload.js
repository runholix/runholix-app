import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import pool from '../db/pool.js';
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

// ── GET /api/upload/parse/:userId/:filename ───────────────────────────────
// Server-side fallback parser for GPX/KML files stored on disk.
// Called when client-side parse yields no metrics (e.g. large FIT files that
// the browser's ArrayBuffer limit can't handle, or complex GPX extensions).
router.get('/parse/:userId/:filename', requireAuth, async (req, res) => {
  if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const filePath = safeFilePath(req.params.userId, req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const ext = path.extname(filePath).toLowerCase();
  if (!['.gpx', '.kml'].includes(ext)) {
    // FIT is binary — server-side parse would need a library; return empty for now
    return res.json({ distance_km: null, elevation_gain_m: null, heart_rate_avg: null, heart_rate_max: null });
  }

  try {
    const text = fs.readFileSync(filePath, 'utf8');
    let result = {};

    if (ext === '.gpx') {
      // Parse GPX with regex (no DOM in Node without jsdom)
      const trkpts = [...text.matchAll(/<trkpt[^>]+lat="([^"]+)"[^>]+lon="([^"]+)"/g)];
      const eles = [...text.matchAll(/<ele>([^<]+)<\/ele>/g)].map(m => parseFloat(m[1]));
      const hrs  = [...text.matchAll(/<(?:gpxtpx:hr|hr)>(\d+)<\/(?:gpxtpx:hr|hr)>/g)].map(m => parseInt(m[1]));

      let distKm = 0, elevGain = 0;
      for (let i = 1; i < trkpts.length; i++) {
        const [lat1, lon1] = [parseFloat(trkpts[i-1][1]), parseFloat(trkpts[i-1][2])];
        const [lat2, lon2] = [parseFloat(trkpts[i][1]),   parseFloat(trkpts[i][2])];
        const R = 6371;
        const dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
        distKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (eles[i] != null && eles[i-1] != null && eles[i] > eles[i-1]) elevGain += eles[i] - eles[i-1];
      }
      result = {
        distance_km:    distKm > 0 ? Math.round(distKm * 1000) / 1000 : null,
        elevation_gain_m: elevGain > 0 ? Math.round(elevGain) : null,
        heart_rate_avg: hrs.length ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null,
        heart_rate_max: hrs.length ? Math.max(...hrs) : null,
      };
    } else if (ext === '.kml') {
      const coordMatch = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
      if (coordMatch) {
        const tuples = coordMatch[1].trim().split(/\s+/).map(t => t.split(',').map(Number));
        let distKm = 0, elevGain = 0, prevLon = null, prevLat = null, prevEle = null;
        for (const [lon, lat, ele] of tuples) {
          if (!isNaN(lat) && !isNaN(lon)) {
            if (prevLat !== null) {
              const R = 6371;
              const dLat = (lat-prevLat)*Math.PI/180, dLon = (lon-prevLon)*Math.PI/180;
              const a = Math.sin(dLat/2)**2 + Math.cos(prevLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
              distKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
            if (!isNaN(ele) && prevEle !== null && ele > prevEle) elevGain += ele - prevEle;
            prevLat = lat; prevLon = lon; prevEle = isNaN(ele) ? null : ele;
          }
        }
        result = {
          distance_km:    distKm > 0 ? Math.round(distKm * 1000) / 1000 : null,
          elevation_gain_m: elevGain > 0 ? Math.round(elevGain) : null,
          heart_rate_avg: null, heart_rate_max: null,
        };
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[parse]', err.message);
    res.json({ distance_km: null, elevation_gain_m: null, heart_rate_avg: null, heart_rate_max: null });
  }
});

// ── Avatar upload — crop 1:1, resize to max 512px, compress ─────────────

const AVATAR_MAX_BYTES = 10 * 1024 * 1024; // 10 MB input limit

function avatarFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  const allowed = ['.jpg', '.jpeg', '.png'];
  const allowedMime = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(ext) && allowedMime.includes(mime)) return cb(null, true);
  cb(new Error('Only JPG/JPEG/PNG images are accepted for avatars'));
}

const avatarUpload = multer({
  storage: multer.memoryStorage(), // process in memory with sharp
  fileFilter: avatarFileFilter,
  limits: { fileSize: AVATAR_MAX_BYTES },
});

// POST /api/upload/avatar
// Accepts JPG/PNG, crops to 1:1, resizes to ≤512px, saves to /uploads/avatars/<userId>.jpg
// Replaces (and deletes) any existing avatar file for this user
router.post('/avatar', requireAuth, avatarUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const avatarDir = path.join(UPLOAD_DIR, 'avatars');
  ensureDir(avatarDir);

  // Fixed output path: always <userId>.jpg (replaces previous automatically)
  const outFilename = `${req.userId}.jpg`;
  const outPath = path.join(avatarDir, outFilename);

  // Delete old file if it exists (it'll be overwritten, but also delete any old .png)
  const oldPng = path.join(avatarDir, `${req.userId}.png`);
  try { if (fs.existsSync(oldPng)) fs.unlinkSync(oldPng); } catch {}

  try {
    const img = sharp(req.file.buffer);
    const meta = await img.metadata();
    const size = Math.min(meta.width, meta.height);

    await img
      .extract({         // centre crop to 1:1
        left:   Math.floor((meta.width  - size) / 2),
        top:    Math.floor((meta.height - size) / 2),
        width:  size,
        height: size,
      })
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(outPath);

    // Store relative avatar path in DB
    const avatarPath = `/avatars/${outFilename}`;
    await pool.query('UPDATE users SET avatar_path=$1 WHERE id=$2', [avatarPath, req.userId]);

    res.json({ avatar_path: avatarPath });
  } catch (err) {
    console.error('[avatar]', err.message);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

// DELETE /api/upload/avatar — remove avatar
router.delete('/avatar', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE users SET avatar_path=NULL WHERE id=$1 RETURNING avatar_path',
      [req.userId]
    );
    const oldPath = rows[0]?.avatar_path;
    if (oldPath) {
      const full = path.join(UPLOAD_DIR, oldPath);
      try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/upload/avatar/:userId — serve avatar (public, no auth needed for display)
router.get('/avatar/:userId', (req, res) => {
  const filename = sanitiseOriginalName(`${req.params.userId}.jpg`);
  const filePath = path.join(UPLOAD_DIR, 'avatars', filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'No avatar' });
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5-min cache
  res.sendFile(path.resolve(filePath));
});

export default router;

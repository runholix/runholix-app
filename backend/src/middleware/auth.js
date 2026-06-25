import jwt from 'jsonwebtoken';
import { buildAuthCookie } from "../utils/authCookies.js";

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...rest] = cookie.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('=') || '');
  }
  return null;
}

export function getAuthToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return readCookie(req, 'rt_token');
}

export function requireAuth(req, res, next) {
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.authToken = token;

    // Slide the 30-day window on every authenticated request
    const newToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.setHeader('Set-Cookie', buildAuthCookie(newToken, {
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
    }));
    req.authToken = newToken; // keep req.authToken in sync for CSRF checks downstream

    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

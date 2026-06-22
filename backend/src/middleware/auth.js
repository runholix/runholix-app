import jwt from 'jsonwebtoken';

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
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

import crypto from 'crypto';

export function readCookie(req, name) {
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

export function signCsrfToken(authToken, secret) {
  return crypto.createHmac('sha256', secret).update(authToken).digest('hex');
}

export function verifyCsrfToken(token, authToken, secret) {
  if (!token || !authToken) return false;
  const expected = signCsrfToken(authToken, secret);
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

export function buildAuthCookie(token, options = {}) {
  const secure = options.secure ?? false;
  const sameSite = (options.sameSite || 'lax').toLowerCase();
  const parts = [
    `rt_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite.charAt(0).toUpperCase() + sameSite.slice(1)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

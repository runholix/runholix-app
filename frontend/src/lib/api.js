const BASE = import.meta.env.VITE_API_URL || '/api';
const RACE_DATE_LIST_KEY = 'rt_race_date_list';
const CSRF_TOKEN_KEY = 'rt_csrf_token';
const CSRF_TOKEN_TS_KEY = 'rt_csrf_token_ts';
const CSRF_TOKEN_TTL_MS = 30 * 60 * 1000;
const CSRF_PUBLIC_PREFIXES = [
  '/auth/login',
  '/auth/register',
  '/auth/activate',
  '/auth/resend-activation',
  '/auth/forgot-password',
  '/auth/forgot-password/confirm',
  '/auth/admin-approve',
  '/auth/passkeys/login/options',
  '/auth/passkeys/login/verify',
];
let csrfTokenPromise = null;

function getToken() { return localStorage.getItem('rt_token'); }

function getStoredCsrfToken() {
  const token = sessionStorage.getItem(CSRF_TOKEN_KEY);
  const ts = Number(sessionStorage.getItem(CSRF_TOKEN_TS_KEY) || 0);
  if (!token || !ts) return null;
  if (Date.now() - ts > CSRF_TOKEN_TTL_MS) {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
    sessionStorage.removeItem(CSRF_TOKEN_TS_KEY);
    return null;
  }
  return token;
}

function storeCsrfToken(token) {
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  sessionStorage.setItem(CSRF_TOKEN_TS_KEY, String(Date.now()));
}

async function fetchCsrfToken() {
  const token = getToken();
  const res = await fetch(`${BASE}/auth/csrf`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.csrfToken) {
    throw new Error(data.error || 'Failed to load CSRF token');
  }
  storeCsrfToken(data.csrfToken);
  return data.csrfToken;
}

async function getCsrfToken() {
  const cached = getStoredCsrfToken();
  if (cached) return cached;
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().finally(() => {
      csrfTokenPromise = null;
    });
  }
  return csrfTokenPromise;
}

function requiresCsrf(options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function isCsrfExemptPath(path) {
  return CSRF_PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

function storeRaceDateList(data) {
  const races = Array.isArray(data) ? data : [];
  const dates = [...new Set(races.map(r => r.race_date?.slice(0, 10)).filter(Boolean))];
  localStorage.setItem(RACE_DATE_LIST_KEY, JSON.stringify(dates));
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (requiresCsrf(options) && !isCsrfExemptPath(path)) {
    headers['x-csrf-token'] = await getCsrfToken();
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err= new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function uploadFile(endpoint, file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (!isCsrfExemptPath(endpoint)) {
    headers['x-csrf-token'] = await getCsrfToken();
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: fd,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Upload failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────
  register:         (body) => request('/auth/register',          { method: 'POST', body: JSON.stringify(body) }),
  activate:         (body) => request('/auth/activate',          { method: 'POST', body: JSON.stringify(body) }),
  resendActivation: (body) => request('/auth/resend-activation', { method: 'POST', body: JSON.stringify(body) }),
  login:            (body) => request('/auth/login',             { method: 'POST', body: JSON.stringify(body) }),
  logout:           ()     => request('/auth/logout',            { method: 'POST' }),
  requestPasswordReset: (body) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  confirmPasswordReset: (body) => request('/auth/forgot-password/confirm', { method: 'POST', body: JSON.stringify(body) }),
  passkeyLoginOptions: (body) => request('/auth/passkeys/login/options', body ? { method: 'POST', body: JSON.stringify(body) } : { method: 'POST' }),
  verifyPasskeyLogin:  (body) => request('/auth/passkeys/login/verify',  { method: 'POST', body: JSON.stringify(body) }),
  me:               ()     => request('/auth/me'),
  updateName:         (body) => request('/auth/name',          { method: 'PUT',  body: JSON.stringify(body) }),
  updateTimezone:     (body) => request('/auth/timezone',      { method: 'PUT',  body: JSON.stringify(body) }),
  changePassword:     (body) => request('/auth/password',      { method: 'PUT',  body: JSON.stringify(body) }),
  getPasskeys:         ()     => request('/auth/passkeys'),
  passkeyRegisterOptions: (body) => request('/auth/passkeys/register/options', { method: 'POST', body: JSON.stringify(body) }),
  verifyPasskeyRegister: (body) => request('/auth/passkeys/register/verify', { method: 'POST', body: JSON.stringify(body) }),
  deletePasskey:       (id, body) => request(`/auth/passkeys/${id}`, { method: 'DELETE', body: JSON.stringify(body) }),
  requestEmailChange: (body) => request('/auth/email',         { method: 'PUT',  body: JSON.stringify(body) }),
  confirmEmail:       (body) => request('/auth/confirm-email', { method: 'POST', body: JSON.stringify(body) }),
  getEmailReminder:        ()     => request('/auth/email-reminder'),
  toggleEmailReminder:     (body) => request('/auth/email-reminder', { method: 'PUT', body: JSON.stringify(body) }),
  adminApprovalDetails: (token) => request(`/auth/admin-approve?token=${encodeURIComponent(token)}`),
  adminApproval:      (body) => request('/auth/admin-approve', { method: 'POST', body: JSON.stringify(body) }),

  // ── iCal calendar feed ───────────────────────────────────────────────────
  getIcal:        ()     => request('/auth/ical'),
  toggleIcal:     (body) => request('/auth/ical', { method: 'PUT', body: JSON.stringify(body) }),

  // ── Races ─────────────────────────────────────────────────────────────
  getDashboard: () => request('/races/dashboard'),
  getRaceCalendar: (year) => request(`/races/calendar?year=${encodeURIComponent(year)}`),
  getRaces:   async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const data = await request(`/races${q ? '?' + q : ''}`);
    storeRaceDateList(data.items);
    return data;
  },
  getStats:   ()         => request('/races/stats'),
  getRace:    (id)       => request(`/races/${id}`),
  createRace: (body)     => request('/races', { method: 'POST', body: JSON.stringify(body) }),
  updateRace: (id, body) => request(`/races/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRace: (id)       => request(`/races/${id}`, { method: 'DELETE' }),

  // ── Training plans ──────────────────────────────────────────────────────
  getTraining:    (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/training${q ? '?' + q : ''}`);
  },
  getTrainingPlan: (id)       => request(`/training/${id}`),
  createTraining:  (body)     => request('/training', { method: 'POST', body: JSON.stringify(body) }),
  updateTraining:  (id, body) => request(`/training/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTraining:  (id)       => request(`/training/${id}`, { method: 'DELETE' }),

  // ── GPX / FIT / KML files (route preview + result activity) ──────────
  // Both route and result files use the same backend endpoint and file types.
  // POST  /api/upload/route            → { route_file_path, route_file_name }
  // GET   /api/upload/route-file/:uid/:filename?name=…&token=…  → download
  // DELETE /api/upload/route-file/:uid/:filename
  uploadRoute: (file, distanceKm) => uploadFile(`/upload/route${distanceKm ? '?distance_km=' + encodeURIComponent(distanceKm) : ''}`, file),
  deleteRouteFile: (userId, filename) =>
    request(`/upload/route-file/${userId}/${filename}`, { method: 'DELETE' }),
  routeFileUrl: (userId, filename, name) =>
    `${BASE}/upload/route-file/${userId}/${encodeURIComponent(filename)}?name=${encodeURIComponent(name)}&token=${getToken()}`,

  // Alias used by the Results section — same /route endpoint, same file types
  uploadResultFile: (file, distanceKm) => uploadFile(`/upload/route${distanceKm ? '?distance_km=' + encodeURIComponent(distanceKm) : ''}`, file),
  deleteResultFile: (userId, filename) =>
    request(`/upload/route-file/${userId}/${filename}`, { method: 'DELETE' }),
  resultFileUrl: (userId, filename, name) =>
    `${BASE}/upload/route-file/${userId}/${encodeURIComponent(filename)}?name=${encodeURIComponent(name)}&token=${getToken()}`,
  // Backend fallback parser — server-side GPX/FIT/KML parse when client parse yields nothing
  parseResultFile: (userId, filename) =>
    request(`/upload/parse/${userId}/${encodeURIComponent(filename)}`),

  // ── PDF attachments (registration + race pack collection) ─────────────
  // POST  /api/upload/attachment            → { attachment_path, attachment_name }
  // GET   /api/upload/attachment/:uid/:filename?token=…[&download=1]  → inline / download
  // DELETE /api/upload/attachment/:uid/:filename
  uploadAttachment:    (file)             => uploadFile('/upload/attachment', file),
  deleteAttachment:    (userId, filename) =>
    request(`/upload/attachment/${userId}/${filename}`, { method: 'DELETE' }),
  attachmentUrl:       (userId, filename) =>
    `${BASE}/upload/attachment/${userId}/${encodeURIComponent(filename)}?token=${getToken()}`,

  // RPC attachment reuses the same PDF endpoint — kept as a named alias for clarity
  uploadRpcAttachment: (file)             => uploadFile('/upload/attachment', file),
  rpcAttachmentUrl:    (userId, filename) =>
    `${BASE}/upload/attachment/${userId}/${encodeURIComponent(filename)}?token=${getToken()}`,

  // ── Avatar ────────────────────────────────────────────────────────────────
  // POST /api/upload/avatar  — accepts JPG/PNG (HEIC converted before send)
  // DELETE /api/upload/avatar
  // GET  /api/upload/avatar/:userId  — public, no token needed
  uploadAvatar:  (file) => uploadFile('/upload/avatar', file),
  deleteAvatar:  ()     => request('/upload/avatar', { method: 'DELETE' }),
  avatarUrl:     (userId) => `${BASE}/upload/avatar/${encodeURIComponent(userId)}`,
};

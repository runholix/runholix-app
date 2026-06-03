const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() { return localStorage.getItem('rt_token'); }

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function uploadFile(endpoint, file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => request('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       ()     => request('/auth/me'),

  // Races
  getRaces:   (params = {}) => { const q = new URLSearchParams(params).toString(); return request(`/races${q ? '?' + q : ''}`); },
  getStats:   ()             => request('/races/stats'),
  getRace:    (id)           => request(`/races/${id}`),
  createRace: (body)         => request('/races', { method: 'POST', body: JSON.stringify(body) }),
  updateRace: (id, body)     => request(`/races/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRace: (id)           => request(`/races/${id}`, { method: 'DELETE' }),

  // File uploads — route files
  uploadRoute: (file) => uploadFile('/upload/route', file),
  deleteRouteFile: (userId, filename) =>
    request(`/upload/route-file/${userId}/${filename}`, { method: 'DELETE' }),
  routeFileUrl: (userId, filename, name) =>
    `${BASE}/upload/route-file/${userId}/${encodeURIComponent(filename)}?name=${encodeURIComponent(name)}&token=${getToken()}`,

  // File uploads — PDF attachments (registration)
  uploadAttachment: (file) => uploadFile('/upload/attachment', file),
  deleteAttachment: (userId, filename) =>
    request(`/upload/attachment/${userId}/${filename}`, { method: 'DELETE' }),
  attachmentUrl: (userId, filename) =>
    `${BASE}/upload/attachment/${userId}/${encodeURIComponent(filename)}?token=${getToken()}`,

  // File uploads — PDF attachments (race pack collection — same endpoint, different form field)
  uploadRpcAttachment: (file) => uploadFile('/upload/attachment', file),
  rpcAttachmentUrl: (userId, filename) =>
    `${BASE}/upload/attachment/${userId}/${encodeURIComponent(filename)}?token=${getToken()}`,
};

const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('rt_token');
}

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

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  // Races
  getRaces: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/races${q ? '?' + q : ''}`);
  },
  getStats: () => request('/races/stats'),
  getRace: (id) => request(`/races/${id}`),
  createRace: (body) => request('/races', { method: 'POST', body: JSON.stringify(body) }),
  updateRace: (id, body) => request(`/races/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRace: (id) => request(`/races/${id}`, { method: 'DELETE' }),
};

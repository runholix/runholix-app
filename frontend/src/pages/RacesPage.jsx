import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../lib/api.js';

function fmtTime(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

const STATUS_META = {
  completed:  { label: 'Completed',  cls: 'badge-completed' },
  registered: { label: 'Registered', cls: 'badge-registered' },
  upcoming:   { label: 'Upcoming',   cls: 'badge-upcoming' },
  dnf:        { label: 'DNF',        cls: 'badge-dnf' },
  dns:        { label: 'DNS',        cls: 'badge-dns' },
};

export default function RacesPage() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', year: '', search: '' });

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.year) params.year = filters.year;
    if (filters.search) params.search = filters.search;
    const data = await api.getRaces(params);
    setRaces(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const years = [...new Set(races.map(r => r.race_date?.slice(0,4)).filter(Boolean))].sort().reverse();

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>My Races</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>{races.length} total</p>
        </div>
        <Link to="/races/new" className="btn btn-primary">
          <i className="ti ti-plus" /> Add race
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-hint)', fontSize: 15 }} />
          <input
            placeholder="Search races…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ width: 150 }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))} style={{ width: 120 }}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', padding: '40px 0' }}>Loading…</div>
      ) : races.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <i className="ti ti-trophy" style={{ fontSize: 40, color: 'var(--color-text-hint)', display: 'block', marginBottom: 12 }} />
          <div style={{ fontWeight: 500, marginBottom: 8 }}>No races found</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>Start tracking your running journey</div>
          <Link to="/races/new" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            <i className="ti ti-plus" /> Add your first race
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['Event', 'Date', 'Distance', 'Bib', 'Finish time', 'Placement', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {races.map(r => {
                const sm = STATUS_META[r.status] || {};
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/races/${r.id}`} style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{r.event_name}</Link>
                      {r.city && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{r.city}{r.country ? `, ${r.country}` : ''}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {r.distance_label || (r.distance_km ? `${parseFloat(r.distance_km).toFixed(1)} km` : '—')}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {r.bib_number ? `#${r.bib_number}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>
                      {fmtTime(r.finish_time_seconds) || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {r.overall_place ? `${r.overall_place}${r.overall_total ? `/${r.overall_total}` : ''}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${sm.cls}`}>{sm.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/races/${r.id}/edit`} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }}>
                        <i className="ti ti-edit" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

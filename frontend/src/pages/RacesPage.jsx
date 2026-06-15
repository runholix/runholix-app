import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../lib/api.js';

// ── Page size with cross-breakpoint page recalculation ────────────────────
function usePageSize(page, setPage) {
  const [size, setSize] = useState(() => window.innerWidth < 768 ? 5 : 10);
  const prevSizeRef = useRef(size);

  useEffect(() => {
    const handler = () => {
      const newSize = window.innerWidth < 768 ? 5 : 10;
      if (newSize === prevSizeRef.current) return;

      setPage(prevPage => {
        let newPage;
        if (newSize === 10) {
          // mobile → desktop: formula (page + page % 2) / 2
          newPage = Math.floor((prevPage + (prevPage % 2)) / 2);
        } else {
          // desktop → mobile: formula (page * 2) - 1
          newPage = prevPage * 2 - 1;
        }
        return Math.max(1, newPage);
      });

      prevSizeRef.current = newSize;
      setSize(newSize);
    };

    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [setPage]);

  return size;
}

// ── Session state persistence ─────────────────────────────────────────────
const SESSION_KEY = 'races_list_state';

function saveListState(state) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
}
function loadListState() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

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

/* Mobile card */
function RaceCard({ r, listState }) {
  const sm = STATUS_META[r.status] || {};
  return (
    <Link to={`/races/${r.id}`} state={{ fromRaces: listState }} style={{ display: 'block', color: 'inherit' }}>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 500, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.event_name}
          </div>
          <span className={`badge ${sm.cls}`} style={{ flexShrink: 0 }}>{sm.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {r.race_date && <span><i className="ti ti-calendar" style={{ verticalAlign: '-2px', marginRight: 3 }} />{format(parseISO(r.race_date), 'dd MMM yyyy')}</span>}
          {(r.city || r.location) && <span><i className="ti ti-map-pin" style={{ verticalAlign: '-2px', marginRight: 3 }} />{r.city || r.location}</span>}
          {(r.distance_label || r.distance_km) && <span><i className="ti ti-route" style={{ verticalAlign: '-2px', marginRight: 3 }} />{r.distance_label || `${parseFloat(r.distance_km).toFixed(1)} km`}</span>}
          {r.race_type && <span><i className="ti ti-tag" style={{ verticalAlign: '-2px', marginRight: 3 }} />{r.race_type.charAt(0).toUpperCase() + r.race_type.slice(1)}</span>}
        </div>
        {(r.finish_time_seconds || r.bib_number) && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
            {r.bib_number && <span style={{ color: 'var(--color-text-muted)' }}>Bib <strong style={{ color: 'var(--color-text)' }}>#{r.bib_number}</strong></span>}
            {r.finish_time_seconds && <span style={{ color: 'var(--color-text-muted)' }}>Time <strong style={{ color: 'var(--color-success)' }}>{fmtTime(r.finish_time_seconds)}</strong></span>}
            {r.overall_place && <span style={{ color: 'var(--color-text-muted)' }}>Place <strong style={{ color: 'var(--color-text)' }}>{r.overall_place}{r.overall_total ? `/${r.overall_total}` : ''}</strong></span>}
          </div>
        )}
      </div>
    </Link>
  );
}

/* Pagination controls */
function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const pages = [];
  const add = n => { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n); };
  add(1); add(page - 1); add(page); add(page + 1); add(totalPages);
  pages.sort((a, b) => a - b);

  const withGaps = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withGaps.push('…');
    withGaps.push(pages[i]);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Showing {from}–{to} of {total} races
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => onChange(page - 1)} disabled={page === 1} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}>
          <i className="ti ti-chevron-left" />
        </button>
        {withGaps.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} style={{ padding: '5px 4px', fontSize: 13, color: 'var(--color-text-hint)' }}>…</span>
          ) : (
            <button key={p} onClick={() => onChange(p)} className="btn btn-sm" style={{
              padding: '5px 10px', minWidth: 34,
              background: p === page ? 'var(--color-primary)' : 'var(--color-surface)',
              color: p === page ? '#fff' : 'var(--color-text)',
              border: `1px solid ${p === page ? 'var(--color-primary)' : 'var(--color-border)'}`,
              fontWeight: p === page ? 600 : 400,
            }}>{p}</button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}>
          <i className="ti ti-chevron-right" />
        </button>
      </div>
    </div>
  );
}

export default function RacesPage() {
  const location = useLocation();

  // ── Restore state from sessionStorage (back navigation) or location.state ─
  const restoredState = (() => {
    // location.state is set when navigating back from detail page
    if (location.state?.restorePage) return location.state;
    return loadListState();
  })();

  const [races, setRaces]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(restoredState?.filters || { status: '', year: '', search: '' });
  const [page, setPage]     = useState(restoredState?.page || 1);

  const pageSize = usePageSize(page, setPage);

  // ── Persist list state to sessionStorage on every change ─────────────────
  useEffect(() => {
    saveListState({ filters, page });
  }, [filters, page]);

  const load = async () => {
    setLoading(true);
    const params = { sort: 'race_date', order: 'desc' };
    if (filters.status) params.status = filters.status;
    if (filters.year)   params.year   = filters.year;
    if (filters.search) params.search = filters.search;
    const data = await api.getRaces(params);
    setRaces(data);
    setLoading(false);
  };

  // Reset to page 1 whenever filters change (but not on initial mount)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      load();
      return;
    }
    setPage(1);
    load();
  }, [filters]);

  // ── After races load, if restoring by raceId, find its page ──────────────
  useEffect(() => {
    if (!restoredState?.scrollToRaceId || !races.length) return;
    const idx = races.findIndex(r => r.id === restoredState.scrollToRaceId);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    setPage(targetPage);
  }, [races]);

  const years = [...new Set(races.map(r => r.race_date?.slice(0, 4)).filter(Boolean))].sort().reverse();

  const totalPages = Math.ceil(races.length / pageSize);
  const paged = races.slice((page - 1) * pageSize, page * pageSize);

  // State passed to each race link so detail page can pass it back
  const listState = { filters, page, scrollToRaceId: null };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Races</h1>
          <p className="page-subtitle">{races.length} total</p>
        </div>
        <Link to="/races/new" className="btn btn-primary">
          <i className="ti ti-plus" /> Add race
        </Link>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-hint)', fontSize: 15, pointerEvents: 'none' }} />
          <input
            placeholder="Search races…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ flex: '0 0 auto', width: 'auto', minWidth: 130 }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))} style={{ flex: '0 0 auto', width: 'auto', minWidth: 110 }}>
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
        <>
          {/* Mobile card list */}
          <div className="mobile-only">
            {paged.map(r => <RaceCard key={r.id} r={r} listState={{ ...listState, scrollToRaceId: r.id }} />)}
            <Pagination page={page} totalPages={totalPages} total={races.length} pageSize={pageSize} onChange={setPage} />
          </div>

          {/* Table */}
          <div className="tablet-up">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {['Event', 'Date', 'Distance', 'Type', 'Bib', 'Finish time', 'Placement', 'Status', ''].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(r => {
                      const sm = STATUS_META[r.status] || {};
                      const raceListState = { ...listState, scrollToRaceId: r.id };
                      return (
                        <tr key={r.id}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td>
                            <Link
                              to={`/races/${r.id}`}
                              state={{ fromRaces: raceListState }}
                              style={{ fontWeight: 500, color: 'var(--color-primary)' }}
                            >
                              {r.event_name}
                            </Link>
                            {r.city && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{r.city}{r.country ? `, ${r.country}` : ''}</div>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'}</td>
                          <td>{r.distance_label || (r.distance_km ? `${parseFloat(r.distance_km).toFixed(1)} km` : '—')}</td>
                          <td>
                            {r.race_type ? (
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                                fontSize: 12, fontWeight: 500,
                                background: r.race_type === 'trail' ? 'var(--color-warning-bg)' : 'var(--color-bg)',
                                color: r.race_type === 'trail' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                border: `1px solid ${r.race_type === 'trail' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                              }}>
                                {r.race_type.charAt(0).toUpperCase() + r.race_type.slice(1)}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ color: 'var(--color-text-muted)' }}>{r.bib_number ? `#${r.bib_number}` : '—'}</td>
                          <td style={{ fontWeight: 500 }}>{fmtTime(r.finish_time_seconds) || '—'}</td>
                          <td>{r.overall_place ? `${r.overall_place}${r.overall_total ? `/${r.overall_total}` : ''}` : '—'}</td>
                          <td><span className={`badge ${sm.cls}`}>{sm.label}</span></td>
                          <td>
                            <Link to={`/races/${r.id}/edit`} className="btn btn-ghost" style={{ padding: '4px 8px' }}>
                              <i className="ti ti-edit" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} totalPages={totalPages} total={races.length} pageSize={pageSize} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

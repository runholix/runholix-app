import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import Pagination from "./Pagination.jsx";
import MobileRaceCard from "./MobileRaceCard.jsx";
import Table from "./Table.jsx";

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

export const STATUS_META = {
  completed:  { label: 'Completed',  cls: 'badge-completed' },
  registered: { label: 'Registered', cls: 'badge-registered' },
  upcoming:   { label: 'Upcoming',   cls: 'badge-upcoming' },
  dnf:        { label: 'DNF',        cls: 'badge-dnf' },
  dns:        { label: 'DNS',        cls: 'badge-dns' },
};

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
            {paged.map(r => <MobileRaceCard key={r.id} r={r} listState={{ ...listState, scrollToRaceId: r.id }} />)}
            <Pagination page={page} totalPages={totalPages} total={races.length} pageSize={pageSize} onChange={setPage} />
          </div>

          {/* Table */}
          <div className="tablet-up">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <Table paged={paged} listState={listState} />
            </div>
            <Pagination page={page} totalPages={totalPages} total={races.length} pageSize={pageSize} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import Pagination from "./Pagination.jsx";
import MobileRaceCard from "./MobileRaceCard.jsx";
import Table from "./Table.jsx";

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
          newPage = Math.floor((prevPage + (prevPage % 2)) / 2);
        } else {
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
  const restoredState = location.state?.restorePage ? location.state : loadListState();

  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(restoredState?.filters || { status: '', year: '', search: '' });
  const [searchInput, setSearchInput] = useState(restoredState?.filters?.search || '');
  const [page, setPage] = useState(restoredState?.page || 1);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [years, setYears] = useState([]);

  const pageSize = usePageSize(page, setPage);
  const prevFiltersRef = useRef(filters);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    saveListState({ filters, page });
  }, [filters, page]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters(f => ({ ...f, search: searchInput }));
      }
    }, 500);

    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
      const load = async () => {
        setLoading(true);
        const params = { sort: 'race_date', order: 'desc', page, pageSize };
        if (filters.status) params.status = filters.status;
        if (filters.year) params.year = filters.year;
        if (filters.search) params.search = filters.search;

      try {
        const data = await api.getRaces(params);
        setRaces(data.items || []);
        setTotal(data.total || 0);
        setYears(Array.isArray(data.years) ? data.years : []);
        setError('');
      } catch (err) {
        console.error(err);
        setError(`Failed to load races list: ${err?.status || ''} ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const filtersChanged =
      prevFiltersRef.current.status !== filters.status ||
      prevFiltersRef.current.year !== filters.year ||
      prevFiltersRef.current.search !== filters.search;

    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      prevFiltersRef.current = filters;
      load();
      return;
    }

    if (filtersChanged && page !== 1) {
      prevFiltersRef.current = filters;
      setPage(1);
      return;
    }

    prevFiltersRef.current = filters;
    load();
  }, [filters, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const listState = { filters, page, scrollToRaceId: null };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Races</h1>
          <p className="page-subtitle">{total} total</p>
        </div>
        <Link to="/races/new" className="btn btn-primary">
          <i className="ti ti-plus" /> Add race
        </Link>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-hint)', fontSize: 15, pointerEvents: 'none' }} />
          <input
            placeholder="Search races..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
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
        <div className="alert-info">Loading...</div>
      ) : error ? (
        <div className="alert-error">{error}</div>
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
          <div className="mobile-only">
            {races.map(r => <MobileRaceCard key={r.id} r={r} listState={{ ...listState, scrollToRaceId: r.id }} />)}
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
          </div>

          <div className="tablet-up">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <Table paged={races} listState={listState} />
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

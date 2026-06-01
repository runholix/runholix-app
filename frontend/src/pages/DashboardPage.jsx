import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { format, parseISO } from 'date-fns';

function fmtTime(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

function fmtDist(km) {
  if (!km) return '—';
  return km >= 1000 ? `${(km/1000).toFixed(1)}k km` : `${parseFloat(km).toFixed(1)} km`;
}

const STATUS_COLORS = {
  completed: '#15803d', registered: '#0369a1',
  upcoming: '#b45309', dnf: '#dc2626', dns: '#7c3aed'
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getRaces({ sort: 'race_date', order: 'desc' })])
      .then(([s, r]) => { setStats(s); setRaces(r); })
      .finally(() => setLoading(false));
  }, []);

  const upcoming = races.filter(r => r.status === 'registered' || r.status === 'upcoming').slice(0, 3);
  const recent = races.filter(r => r.status === 'completed').slice(0, 5);

  const yearlyData = races.reduce((acc, r) => {
    const yr = r.race_date?.slice(0, 4);
    if (!yr) return acc;
    acc[yr] = (acc[yr] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(yearlyData).sort().map(([year, count]) => ({ year, count }));

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading dashboard…</div>
  );

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Here's your running race overview.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Races completed', value: stats?.total_completed || 0, icon: 'ti-trophy', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          { label: 'Upcoming', value: stats?.upcoming_count || 0, icon: 'ti-calendar-event', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
          { label: 'Total distance', value: fmtDist(stats?.total_distance_km), icon: 'ti-route', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
          { label: 'Best marathon', value: stats?.best_marathon ? fmtTime(stats.best_marathon) : '—', icon: 'ti-medal', color: '#7c3aed', bg: '#faf5ff' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>
                <i className={`ti ${s.icon}`} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Personal bests</div>
          {[
            { label: '10 km', value: fmtTime(stats?.best_10k) },
            { label: 'Half marathon', value: fmtTime(stats?.best_half) },
            { label: 'Marathon', value: fmtTime(stats?.best_marathon) },
          ].map(pb => (
            <div key={pb.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{pb.label}</span>
              <span style={{ fontWeight: 500 }}>{pb.value}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Races per year</div>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} barSize={32}>
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'var(--color-bg)' }} contentStyle={{ fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? '#1d4ed8' : '#93c5fd'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 20 }}>No race data yet.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Upcoming races</div>
            <Link to="/races/new" className="btn btn-primary" style={{ fontSize: 12, padding: '5px 10px' }}>
              <i className="ti ti-plus" /> Add race
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No upcoming races. <Link to="/races/new" style={{ color: 'var(--color-primary)' }}>Register one →</Link></div>
          ) : upcoming.map(r => (
            <Link to={`/races/${r.id}`} key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)', color: 'inherit' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{r.event_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'} · {r.city || r.location || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {r.bib_number && <div style={{ fontSize: 12, fontWeight: 500 }}>#{r.bib_number}</div>}
                {r.distance_label && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.distance_label}</div>}
              </div>
            </Link>
          ))}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Recent results</div>
            <Link to="/races" style={{ fontSize: 12, color: 'var(--color-primary)' }}>View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No completed races yet.</div>
          ) : recent.map(r => (
            <Link to={`/races/${r.id}`} key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)', color: 'inherit' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{r.event_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'} · {r.distance_label || (r.distance_km ? `${r.distance_km} km` : '')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 500, color: 'var(--color-success)' }}>{fmtTime(r.finish_time_seconds)}</div>
                {r.overall_place && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>#{r.overall_place}{r.overall_total ? `/${r.overall_total}` : ''}</div>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

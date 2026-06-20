import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { format, parseISO } from 'date-fns';
import { fmtDist, fmtTime, paceStr } from "../lib/utils.js";

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

  if (loading) return <div className="page" style={{ color: 'var(--color-text-muted)' }}>Loading dashboard…</div>;

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">Here's your running race overview.</p>
      </div>

      {/* Stat cards — 2 col mobile, 4 col desktop */}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        {[
          { label: 'Races completed', value: stats?.total_completed || 0, icon: 'ti-trophy', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          { label: 'Upcoming', value: stats?.upcoming_count || 0, icon: 'ti-calendar-event', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
          { label: 'Total distance', value: fmtDist(stats?.total_distance_km), icon: 'ti-route', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
          { label: 'Total elevation', value: stats?.total_elevation_m > 0 ? `${Number(stats.total_elevation_m).toLocaleString("en-US")} m` : '—', icon: 'ti-mountain', color: '#7c3aed', bg: '#faf5ff' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 17, flexShrink: 0 }}>
                <i className={`ti ${s.icon}`} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* PB + Chart — stacked mobile, side by side desktop */}
      <div className="grid-halves" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Personal bests</div>
          {[
            { label: '5 km',          sec: stats?.best_5k,       distKm: 5 },
            { label: '10 km',         sec: stats?.best_10k,      distKm: 10 },
            { label: 'Half marathon', sec: stats?.best_half,     distKm: 21.0975 },
            { label: 'Marathon',      sec: stats?.best_marathon, distKm: 42.195 },
          ].map(pb => (
            <div key={pb.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)', gap: 8 }}>
              <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{pb.label}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 500 }}>{pb.sec ? fmtTime(pb.sec) : '—'}</span>
                {paceStr(pb.sec, pb.distKm) && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 1 }}>{paceStr(pb.sec, pb.distKm)}</div>
                )}
              </div>
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

      {/* Upcoming + Recent — stacked mobile, side by side desktop */}
      <div className="grid-halves">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Upcoming races</div>
            <Link to="/races/new" className="btn btn-primary btn-sm">
              <i className="ti ti-plus" /> Add race
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              No upcoming races. <Link to="/races/new" style={{ color: 'var(--color-primary)' }}>Register one →</Link>
            </div>
          ) : upcoming.map(r => (
            <Link to={`/races/${r.id}`} key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)', color: 'inherit' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'} · {r.city || r.location || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'} · {r.distance_label || (r.distance_km ? `${r.distance_km} km` : '')}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
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

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { format, parseISO } from 'date-fns';
import { fmtDist, fmtNum, fmtTime, paceStr } from "../lib/utils.js";

function YearTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div>Races: {row.count ?? 0}</div>
      <div>Distance: {fmtDist(row.total_distance_km)}</div>
      <div>Elevation: {Number(row.total_elevation_m || 0).toLocaleString('en-US')} m</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState({ upcoming: [], recent: [], yearlyCounts: [] });
  const [pbWindow, setPbWindow] = useState('all_time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [s, d] = await Promise.all([api.getStats(), api.getDashboard()]);
        setStats(s);
        setDashboard(d || { upcoming: [], recent: [], yearlyCounts: [] });
        setError('');
      } catch (err) {
        console.error(err);
        setError(`Failed to load dashboard data: ${err?.status || ''} ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const upcoming = dashboard.upcoming || [];
  const recent = dashboard.recent || [];
  const chartData = (dashboard.yearlyCounts || []).map(({ year, count, total_distance_km, total_elevation_m }) => ({
    year,
    count,
    total_distance_km,
    total_elevation_m,
  }));
  const pbSet = stats?.personal_bests?.[pbWindow] || {};
  const personalBests = [
    { key: 'best_5k', label: '5 km', distKm: 5 },
    { key: 'best_10k', label: '10 km', distKm: 10 },
    { key: 'best_half', label: 'Half marathon', distKm: 21.0975 },
    { key: 'best_marathon', label: 'Marathon', distKm: 42.195 },
  ].map(item => ({ ...item, record: pbSet[item.key] || null }));

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">Here's your running race overview.</p>
      </div>

      {loading ? (
        <div className="alert-info">Loading...</div>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : (
        <>
          <div className="grid-stats" style={{ marginBottom: 24 }}>
            {[
              { label: 'Races completed', value: stats?.total_completed || 0, icon: 'ti-trophy', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
              { label: 'Upcoming', value: stats?.upcoming_count || 0, icon: 'ti-calendar-event', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
              { label: 'Total distance', value: fmtDist(stats?.total_distance_km), icon: 'ti-route', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
              { label: 'Total elevation', value: stats?.total_elevation_m > 0 ? `${Number(stats.total_elevation_m).toLocaleString("en-US")} m` : '—', icon: 'ti-mountain', color: 'var(--color-purple)', bg: 'var(--color-purple-bg)' },
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

          <div className="grid-halves" style={{ marginBottom: 24 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Personal bests</div>
                <div style={{ display: 'inline-flex', gap: 6, padding: 4, borderRadius: 8, background: 'var(--color-bg-secondary)' }}>
                  {[
                    { key: 'all_time', label: 'All time' },
                    { key: 'last_year', label: 'Last 1 year' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPbWindow(opt.key)}
                      className="btn btn-sm"
                      style={{
                        minWidth: 0,
                        background: pbWindow === opt.key ? 'var(--color-bg)' : 'transparent',
                        border: pbWindow === opt.key ? '1px solid var(--color-border)' : '1px solid transparent',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {personalBests.map(pb => {
                const hasRace = !!pb.record?.race_id;
                const content = (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)', gap: 8 }}>
                    <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{pb.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 500, color: pb.record?.finish_time_seconds ? 'var(--color-success)' : null }}>{pb.record?.finish_time_seconds ? fmtTime(pb.record.finish_time_seconds) : '—'}</span>
                      {paceStr(pb.record?.finish_time_seconds, pb.distKm) && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 1 }}>{paceStr(pb.record.finish_time_seconds, pb.distKm)}</div>
                      )}
                    </div>
                  </div>
                );
                return hasRace ? (
                  <Link key={pb.key} to={`/races/${pb.record.race_id}`} style={{ display: 'block', color: 'inherit' }}>
                    {content}
                  </Link>
                ) : (
                  <div key={pb.key}>{content}</div>
                );
              })}
            </div>

            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Races per year</div>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData} barSize={32}>
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: 'var(--color-bg)' }} content={<YearTooltip />} />
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
                      {r.race_date ? format(parseISO(r.race_date), 'dd MMM yyyy') : '—'} · {r.distance_label || (r.distance_km ? `${fmtNum(r.distance_km, { decimals: 1, suffix: 'km' })}` : '')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontWeight: 500, color: 'var(--color-success)' }}>{fmtTime(r.finish_time_seconds)}</div>
                    {paceStr(r.finish_time_seconds, r.distance_km) && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 1 }}>{paceStr(r.finish_time_seconds, r.distance_km)}</div>
                    )}
                    {r.overall_place && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>#{r.overall_place}{r.overall_total ? `/${r.overall_total}` : ''}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

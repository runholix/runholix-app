import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fmtTime } from "../../../lib/utils.js";
import { STATUS_META } from "./RacesPage.jsx";

export default function Table({ paged, listState }) {
    return (
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
    )
}
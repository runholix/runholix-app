import { STATUS_META } from "./RacesPage.jsx";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fmtTime } from "../../../lib/utils.js";

export default function MobileRaceCard({ r, listState }) {
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
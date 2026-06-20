import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fmtTime } from "../../../lib/utils.js";
import { api } from "../../../lib/api.js";
import { useState } from "react";

export default function HeaderSection({ race, id }) {
    const STATUS_META = {
        completed: { label: 'Completed', cls: 'badge-completed' },
        registered: { label: 'Registered', cls: 'badge-registered' },
        upcoming: { label: 'Upcoming', cls: 'badge-upcoming' },
        dnf: { label: 'DNF', cls: 'badge-dnf' },
        dns: { label: 'DNS', cls: 'badge-dns' },
    };
    const sm = STATUS_META[race.status] || {};
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Delete "${race.event_name}"? This cannot be undone.`)) return;
        setDeleting(true);
        await api.deleteRace(id);
        navigate('/races');
    };

    return (
        <>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: 20, fontWeight: 600 }}>{race.event_name}</h1>
                            <span className={`badge ${sm.cls}`}>{sm.label}</span>
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            {race.race_date && <span><i className="ti ti-calendar" style={{ verticalAlign: '-2px', marginRight: 4 }} />{format(parseISO(race.race_date), 'EEEE, d MMMM yyyy')}</span>}
                            {(race.city || race.location) && <span><i className="ti ti-map-pin" style={{ verticalAlign: '-2px', marginRight: 4 }} />{race.city || race.location}{race.country ? `, ${race.country}` : ''}</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <Link to={`/races/${id}/edit`} className="btn btn-secondary btn-sm">
                            <i className="ti ti-edit" /> Edit
                        </Link>
                        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                            <i className="ti ti-trash" /> Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Result highlight cards */}
            {race.status === 'completed' && race.finish_time_seconds && (
                <div className="result-cards">
                    {[
                        { label: 'Finish time', value: fmtTime(race.finish_time_seconds), icon: 'ti-clock', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                        { label: 'Overall place', value: race.overall_place ? `${Number(race.overall_place).toLocaleString("en-US")}${race.overall_total ? ` / ${Number(race.overall_total).toLocaleString("en-US")}` : ''}` : '—', icon: 'ti-users', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
                        { label: 'Gender place', value: race.gender_place ? `${Number(race.gender_place).toLocaleString("en-US")}${race.gender_total ? ` / ${Number(race.gender_total).toLocaleString("en-US")}` : ''}` : '—', icon: 'ti-user', color: '#7c3aed', bg: '#faf5ff' },
                        { label: 'Age group', value: race.age_group_place ? `${Number(race.age_group_place).toLocaleString("en-US")}${race.age_group_total ? ` / ${Number(race.age_group_total).toLocaleString("en-US")}` : ''} ${race.age_group_label || ''}`.trim() : '—', icon: 'ti-medal', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 6, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 14, flexShrink: 0 }}>
                                    <i className={`ti ${s.icon}`} />
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 600 }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}
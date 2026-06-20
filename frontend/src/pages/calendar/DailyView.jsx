import { format } from "date-fns";
import { EVENT_COLORS, eventIcon, eventsForDate } from "./CalendarPage.jsx";

export default function DailyView({ date, events, onEventClick }) {
    const ds = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsForDate(events, ds);

    return (
        <div className="card" style={{ minHeight: 300 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>
                {format(date, 'EEEE, d MMMM yyyy')}
            </div>
            {dayEvents.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events on this day.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dayEvents.map((ev, i) => {
                        const c = EVENT_COLORS[ev.type];
                        // Time to display: flag_off for race, rpc_time for rpc, plan_time for training
                        const displayTime = ev.time;
                        const typeLabel = ev.type === 'race' ? 'Race' : ev.type === 'registration' ? 'Registration' : ev.type === 'rpc' ? 'Race Pack Collection' : 'Training';
                        return (
                            <div
                                key={i}
                                onClick={e => onEventClick(ev, e)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 14px', borderRadius: 'var(--radius)',
                                    background: c.bg, border: `1px solid ${c.border}`,
                                    cursor: 'pointer',
                                }}
                            >
                <span style={{ fontSize: 20, flexShrink: 0 }}>
                  {eventIcon(ev.type)}
                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, fontSize: 14, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {ev.label}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                        {typeLabel}
                                        {displayTime ? ` · ${displayTime}` : ''}
                                    </div>
                                </div>
                                <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
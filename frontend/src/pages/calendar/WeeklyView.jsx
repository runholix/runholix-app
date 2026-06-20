import useWindowWidth from "../../hooks/useWindowWidth.jsx";
import { addDays, eachDayOfInterval, format, isToday, startOfWeek } from "date-fns";
import { EVENT_COLORS, eventIcon, eventsForDate } from "./CalendarPage.jsx";
import EventChip from "./EventChip.jsx";

export default function WeeklyView({ date, events, onEventClick, onDayClick }) {
    const w = useWindowWidth();
    const isMobile = w < 640;
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const days  = eachDayOfInterval({ start, end: addDays(start, 6) });

    // ── Mobile: vertical list of days ────────────────────────────────────
    if (isMobile) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {days.map(day => {
                    const ds = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsForDate(events, ds);
                    const todayStyle = isToday(day);
                    return (
                        <div
                            key={ds}
                            className="card"
                            style={{
                                padding: '12px 14px',
                                border: todayStyle ? `2px solid var(--color-primary)` : '1px solid var(--color-border)',
                                background: todayStyle ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                            }}
                        >
                            {/* Day header row */}
                            <div
                                onClick={() => onDayClick(day)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: dayEvents.length ? 10 : 0, cursor: 'pointer' }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    background: todayStyle ? 'var(--color-primary)' : 'var(--color-bg)',
                                }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: todayStyle ? '#fff' : 'var(--color-text-muted)', lineHeight: 1, textTransform: 'uppercase' }}>
                                        {format(day, 'EEE')}
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: todayStyle ? '#fff' : 'var(--color-text)', lineHeight: 1.2 }}>
                                        {format(day, 'd')}
                                    </div>
                                </div>
                                <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-muted)' }}>
                                    {format(day, 'MMMM yyyy')}
                                </div>
                                {dayEvents.length > 0 && (
                                    <div style={{ display: 'flex', gap: 3 }}>
                                        {[...new Set(dayEvents.map(e => e.type))].map(type => (
                                            <span key={type} style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_COLORS[type].border, display: 'inline-block' }} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Events for this day */}
                            {dayEvents.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 46 }}>
                                    {dayEvents.map((ev, i) => {
                                        const c = EVENT_COLORS[ev.type];
                                        return (
                                            <div
                                                key={i}
                                                onClick={e => { e.stopPropagation(); onEventClick(ev, e); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '7px 10px', borderRadius: 'var(--radius)',
                                                    background: c.bg, border: `1px solid ${c.border}`,
                                                    cursor: 'pointer',
                                                }}
                                            >
                        <span style={{ fontSize: 14, flexShrink: 0 }}>
                          {eventIcon(ev.type)}
                        </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ev.label}
                                                    </div>
                                                    {ev.time && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ev.time}</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ── Desktop: 7-column horizontal grid ────────────────────────────────
    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: 'var(--color-bg)' }}>
                {days.map((day, idx) => (
                    <div
                        key={day.toISOString()}
                        onClick={() => onDayClick(day)}
                        style={{
                            padding: '8px 4px', textAlign: 'center', cursor: 'pointer',
                            borderBottom: '1px solid var(--color-border)',
                            borderRight: idx === 6 ? 'none' : '1px solid var(--color-border)',
                            background: isToday(day) ? 'var(--color-primary-bg)' : '',
                        }}
                    >
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)' }}>{format(day, 'EEE')}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: isToday(day) ? 'var(--color-primary)' : 'var(--color-text)' }}>{format(day, 'd')}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                {days.map((day, idx) => {
                    const ds = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsForDate(events, ds);
                    return (
                        <div key={ds} style={{
                            minHeight: 160, padding: '6px 4px',
                            borderRight: idx === 6 ? 'none' : '1px solid var(--color-border)',
                            background: isToday(day) ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                        }}>
                            {dayEvents.map((ev, i) => (
                                <EventChip key={i} event={ev} onEventClick={onEventClick} />
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
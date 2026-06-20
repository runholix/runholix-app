import { useState } from "react";
import {
    eachDayOfInterval, endOfMonth, endOfWeek,
    format, isSameMonth, isToday, parseISO, startOfMonth,
    startOfWeek,
} from "date-fns";
import useWindowWidth from "../../hooks/useWindowWidth.jsx";
import { EVENT_COLORS, eventIcon, eventsForDate } from "./CalendarPage.jsx";
import EventChip from "./EventChip.jsx";

export default function MonthlyView({ date, events, onEventClick, onDayClick }) {
    const w = useWindowWidth();
    const isMobile = w < 640;
    const [selectedDay, setSelectedDay] = useState(null);
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(date),     { weekStartsOn: 1 });
    const days  = eachDayOfInterval({ start, end });

    const handleDayTap = (day) => {
        if (isMobile) {
            const ds = format(day, 'yyyy-MM-dd');
            const sel = selectedDay === ds ? null : ds;
            setSelectedDay(sel);
            // Still drill down on double-tap / explicit nav
        } else {
            onDayClick(day);
        }
    };

    const selectedEvents = selectedDay ? eventsForDate(events, selectedDay) : [];

    return (
        <div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: isMobile && selectedDay ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)', overflow: 'hidden' }}>
                {/* Day-of-week header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--color-bg)' }}>
                    {(isMobile
                            ? ['Mo','Tu','We','Th','Fr','Sa','Su']
                            : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
                    ).map((d, i) => (
                        <div key={i} style={{
                            padding: isMobile ? '6px 2px' : '8px 4px',
                            textAlign: 'center',
                            fontSize: isMobile ? 10 : 12,
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            borderBottom: '1px solid var(--color-border)',
                        }}>{d}</div>
                    ))}
                </div>

                {/* Day grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                    {days.map((day, idx) => {
                        const ds = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsForDate(events, ds);
                        const inMonth = isSameMonth(day, date);
                        const todayStyle = isToday(day);
                        const isSelected = isMobile && selectedDay === ds;

                        return (
                            <div
                                key={ds}
                                onClick={() => handleDayTap(day)}
                                style={{
                                    minHeight: isMobile ? 44 : 120,
                                    padding: isMobile ? '4px 2px' : '4px',
                                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--color-border)',
                                    borderBottom: '1px solid var(--color-border)',
                                    background: isSelected ? 'var(--color-primary-bg)' : !inMonth ? 'var(--color-bg)' : todayStyle ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Day number */}
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div style={{
                                        width: 24,
                                        height: 24,
                                        lineHeight: '24px',
                                        textAlign: 'center',
                                        fontSize: 12,
                                        fontWeight: todayStyle ? 700 : 400,
                                        color: !inMonth ? 'var(--color-text-hint)' : todayStyle ? '#fff' : isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                        background: todayStyle ? 'var(--color-primary)' : 'transparent',
                                        borderRadius: todayStyle ? '50%' : 0,
                                        marginBottom: isMobile ? 2 : 2,
                                    }}>
                                        {format(day, 'd')}
                                    </div>
                                </div>

                                {/* Mobile: coloured dots */}
                                {isMobile && inMonth && dayEvents.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                                        {[...new Set(dayEvents.map(e => e.type))].slice(0, 3).map((type, i) => (
                                            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: EVENT_COLORS[type].border, display: 'block' }} />
                                        ))}
                                    </div>
                                )}

                                {/* Desktop: chips */}
                                {!isMobile && (
                                    <>
                                        {dayEvents.slice(0, 3).map((ev, i) => (
                                            <EventChip key={i} event={ev} onEventClick={onEventClick} />
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <div style={{ fontSize: 10, color: 'var(--color-text-hint)', paddingLeft: 2 }}>
                                                +{dayEvents.length - 3}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile: event list for selected day */}
            {isMobile && selectedDay && (
                <div style={{
                    border: '1px solid var(--color-border)',
                    borderTop: 'none',
                    borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                    background: 'var(--color-surface)',
                    padding: 12,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        {format(parseISO(selectedDay), 'EEEE, d MMMM')}
                        <button
                            onClick={() => onDayClick(parseISO(selectedDay))}
                            style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                        >
                            Day view →
                        </button>
                    </div>
                    {selectedEvents.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--color-text-hint)' }}>No events</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {selectedEvents.map((ev, i) => {
                                const c = EVENT_COLORS[ev.type];
                                return (
                                    <div
                                        key={i}
                                        onClick={e => { e.stopPropagation(); onEventClick(ev, e); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 10px', borderRadius: 'var(--radius)',
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
                                        <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-hint)', flexShrink: 0, fontSize: 13 }} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

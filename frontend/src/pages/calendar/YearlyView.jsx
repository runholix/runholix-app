import {
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    getYear,
    isSameMonth, isToday,
    startOfMonth,
    startOfWeek
} from "date-fns";
import { EVENT_COLORS, eventsForDate } from "./CalendarPage.jsx";

export default function YearlyView({ date, events, onEventClick, onDayClick }) {
    const months = Array.from({ length: 12 }, (_, i) => new Date(getYear(date), i, 1));
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {months.map(month => {
                const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
                const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 });
                const days  = eachDayOfInterval({ start, end });
                return (
                    <div key={month.toISOString()} className="card" style={{ padding: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, textAlign: 'center' }}>
                            {format(month, 'MMMM')}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
                            {['M','T','W','T','F','S','S'].map((d, i) => (
                                <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--color-text-hint)', paddingBottom: 3 }}>{d}</div>
                            ))}
                            {days.map(day => {
                                const ds = format(day, 'yyyy-MM-dd');
                                const dayEvents = eventsForDate(events, ds);
                                const inMonth = isSameMonth(day, month);
                                const raceEvt  = dayEvents.find(e => e.type === 'race');
                                const regEvt   = dayEvents.find(e => e.type === 'registration');
                                const rpcEvt   = dayEvents.find(e => e.type === 'rpc');
                                const trainEvt = dayEvents.find(e => e.type === 'training');
                                return (
                                    <div
                                        key={ds}
                                        onClick={() => onDayClick(day)}
                                        style={{
                                            textAlign: 'center', fontSize: 9, padding: '2px 1px',
                                            color: !inMonth ? 'var(--color-text-hint)' : isToday(day) ? 'var(--color-primary)' : 'var(--color-text)',
                                            fontWeight: isToday(day) ? 700 : 400,
                                            cursor: 'pointer',
                                            borderRadius: 2,
                                            background: isToday(day) ? 'var(--color-primary-bg)' : '',
                                        }}
                                    >
                                        {format(day, 'd')}
                                        {inMonth && (raceEvt || regEvt || rpcEvt || trainEvt) && (
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 1 }}>
                                                {raceEvt  && <span onClick={e => { e.stopPropagation(); onEventClick(raceEvt, e); }} style={{ width: 4, height: 4, borderRadius: '50%', background: EVENT_COLORS.race.border, display: 'block', cursor: 'pointer' }} />}
                                                {regEvt   && <span onClick={e => { e.stopPropagation(); onEventClick(regEvt, e); }}   style={{ width: 4, height: 4, borderRadius: '50%', background: EVENT_COLORS.registration.border, display: 'block', cursor: 'pointer' }} />}
                                                {rpcEvt   && <span onClick={e => { e.stopPropagation(); onEventClick(rpcEvt, e); }}  style={{ width: 4, height: 4, borderRadius: '50%', background: EVENT_COLORS.rpc.border, display: 'block', cursor: 'pointer' }} />}
                                                {trainEvt && <span onClick={e => { e.stopPropagation(); onEventClick(trainEvt, e); }} style={{ width: 4, height: 4, borderRadius: '50%', background: EVENT_COLORS.training.border, display: 'block', cursor: 'pointer' }} />}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

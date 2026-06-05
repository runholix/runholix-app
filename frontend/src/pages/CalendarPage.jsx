import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval,
  format, addMonths, subMonths, addWeeks, subWeeks,
  addDays, subDays, addYears, subYears,
  isSameMonth, isSameDay, isToday, parseISO, getMonth, getYear,
  startOfDay,
} from 'date-fns';
import { api } from '../lib/api.js';

// ── Helpers ───────────────────────────────────────────────────────────────
const VIEWS = ['yearly', 'monthly', 'weekly', 'daily'];
const VIEW_LABELS = { yearly: 'Year', monthly: 'Month', weekly: 'Week', daily: 'Day' };

const EVENT_COLORS = {
  race:     { bg: '#dbeafe', border: '#3b82f6', text: '#1d40b0' },
  rpc:      { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  training: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
};

function eventStyle(type) {
  const c = EVENT_COLORS[type];
  return {
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: c.text,
    borderRadius: 4,
    padding: '1px 5px',
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    marginBottom: 2,
    display: 'block',
  };
}

// ── Training Plan Form Modal ──────────────────────────────────────────────
function TrainingModal({ plan, races, defaultDate, onSave, onClose }) {
  const [form, setForm] = useState({
    name: plan?.name || '',
    plan_date: plan?.plan_date?.slice(0, 10) || defaultDate || '',
    plan_time: plan?.plan_time || '',
    race_id: plan?.race_id || '',
    notes: plan?.notes || '',
  });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const filteredRaces = races.filter(r =>
    r.event_name.toLowerCase().includes(search.toLowerCase())
  );

  const submit = async e => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      if (plan?.id) {
        await api.updateTraining(plan.id, form);
      } else {
        await api.createTraining(form);
      }
      onSave();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{plan?.id ? 'Edit training plan' : 'Add training plan'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><i className="ti ti-x" /></button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Long run 30km" required />
          </div>
          <div className="grid-form-2">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" value={form.plan_date} onChange={set('plan_date')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Time (optional)</label>
              <input value={form.plan_time} onChange={set('plan_time')} placeholder="e.g. 05:30 or Morning" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Related race (optional)</label>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value) setForm(f => ({ ...f, race_id: '' })); }}
              placeholder="Search races…"
              style={{ marginBottom: 4 }}
            />
            {search && (
              <div style={{
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                maxHeight: 160, overflowY: 'auto', background: 'var(--color-surface)',
              }}>
                <div
                  onClick={() => { setForm(f => ({ ...f, race_id: '' })); setSearch(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  — None
                </div>
                {filteredRaces.map(r => (
                  <div
                    key={r.id}
                    onClick={() => { setForm(f => ({ ...f, race_id: r.id })); setSearch(r.event_name); }}
                    style={{
                      padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                      background: form.race_id === r.id ? 'var(--color-primary-bg)' : '',
                      color: form.race_id === r.id ? 'var(--color-primary)' : '',
                    }}
                    onMouseEnter={e => { if (form.race_id !== r.id) e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { if (form.race_id !== r.id) e.currentTarget.style.background = ''; }}
                  >
                    <div style={{ fontWeight: 500 }}>{r.event_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{r.race_date?.slice(0, 10)}</div>
                  </div>
                ))}
                {filteredRaces.length === 0 && (
                  <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--color-text-hint)' }}>No races found</div>
                )}
              </div>
            )}
            {form.race_id && !search && (
              <div style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 2 }}>
                ✓ {races.find(r => r.id === form.race_id)?.event_name}
                <button type="button" onClick={() => { setForm(f => ({ ...f, race_id: '' })); setSearch(''); }}
                  style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--color-text-hint)', cursor: 'pointer', fontSize: 12 }}>×</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3}
              placeholder="Details, targets, gear…" style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <i className={`ti ${saving ? 'ti-loader' : 'ti-check'}`} />
              {saving ? 'Saving…' : plan?.id ? 'Save changes' : 'Add plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Training Detail Popup ─────────────────────────────────────────────────
function TrainingPopup({ plan, anchorRect, onEdit, onDelete, onClose }) {
  const ref = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const style = {
    position: 'fixed',
    zIndex: 400,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    padding: 16,
    minWidth: 260,
    maxWidth: 320,
  };

  // Position near anchor
  if (anchorRect) {
    style.top = Math.min(anchorRect.bottom + 6, window.innerHeight - 200);
    style.left = Math.min(anchorRect.left, window.innerWidth - 340);
  }

  return (
    <div ref={ref} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14, flex: 1, marginRight: 8 }}>{plan.name}</div>
        <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '2px 4px' }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        <span><i className="ti ti-calendar" style={{ verticalAlign: '-2px', marginRight: 4 }} />{format(parseISO(plan.plan_date), 'dd MMM yyyy')}</span>
        {plan.plan_time && <span><i className="ti ti-clock" style={{ verticalAlign: '-2px', marginRight: 4 }} />{plan.plan_time}</span>}
        {plan.race_name && <span><i className="ti ti-trophy" style={{ verticalAlign: '-2px', marginRight: 4 }} />{plan.race_name}</span>}
      </div>
      {plan.notes && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{plan.notes}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onEdit} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
          <i className="ti ti-edit" /> Edit
        </button>
        <button onClick={onDelete} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
          <i className="ti ti-trash" /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Event Dot / Chip (shared across views) ────────────────────────────────
function EventChip({ event, onEventClick }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onEventClick(event, e); }}
      style={eventStyle(event.type)}
      title={event.label}
    >
      {event.type === 'race' && '🏃 '}
      {event.type === 'rpc' && '📦 '}
      {event.type === 'training' && '📋 '}
      {event.label}
    </span>
  );
}

// ── Build event list from races + training ────────────────────────────────
function buildEvents(races, training) {
  const events = [];
  races.forEach(r => {
    if (r.race_date) {
      events.push({ type: 'race', date: r.race_date.slice(0, 10), label: r.event_name, id: r.id });
    }
    if (r.rpc_date_start) {
      const label = `RPC: ${r.event_name}`;
      // Show on start date; if range, show on both
      events.push({ type: 'rpc', date: r.rpc_date_start.slice(0, 10), label, id: r.id });
      if (r.rpc_date_end && r.rpc_date_end.slice(0, 10) !== r.rpc_date_start.slice(0, 10)) {
        events.push({ type: 'rpc', date: r.rpc_date_end.slice(0, 10), label: `${label} (end)`, id: r.id });
      }
    }
  });
  training.forEach(t => {
    events.push({ type: 'training', date: t.plan_date.slice(0, 10), label: t.name, id: t.id, plan: t });
  });
  return events;
}

function eventsForDate(events, dateStr) {
  return events.filter(e => e.date === dateStr);
}

// ── YEARLY VIEW ───────────────────────────────────────────────────────────
function YearlyView({ date, events, onEventClick, onDayClick }) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(getYear(date), i, 1));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {months.map(month => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        const end   = endOfWeek(endOfMonth(month),   { weekStartsOn: 1 });
        const days  = eachDayOfInterval({ start, end });
        return (
          <div key={month.toISOString()} className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              {format(month, 'MMMM')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--color-text-hint)', paddingBottom: 4 }}>{d}</div>
              ))}
              {days.map(day => {
                const ds = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsForDate(events, ds);
                const inMonth = isSameMonth(day, month);
                const raceEvt = dayEvents.find(e => e.type === 'race');
                const rpcEvt  = dayEvents.find(e => e.type === 'rpc');
                const trainEvt= dayEvents.find(e => e.type === 'training');
                return (
                  <div
                    key={ds}
                    onClick={() => onDayClick && onDayClick(day)}
                    style={{
                      textAlign: 'center', fontSize: 10, padding: '2px 0',
                      color: !inMonth ? 'var(--color-text-hint)' : isToday(day) ? 'var(--color-primary)' : 'var(--color-text)',
                      fontWeight: isToday(day) ? 700 : 400,
                      cursor: 'pointer',
                      position: 'relative',
                      borderRadius: 3,
                      background: isToday(day) ? 'var(--color-primary-bg)' : '',
                    }}
                  >
                    {format(day, 'd')}
                    {inMonth && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 1, flexWrap: 'wrap' }}>
                        {raceEvt  && <span style={{ width: 5, height: 5, borderRadius: '50%', background: EVENT_COLORS.race.border, display: 'block' }} title={raceEvt.label} onClick={e => { e.stopPropagation(); onEventClick(raceEvt, e); }} />}
                        {rpcEvt   && <span style={{ width: 5, height: 5, borderRadius: '50%', background: EVENT_COLORS.rpc.border, display: 'block' }} title={rpcEvt.label} onClick={e => { e.stopPropagation(); onEventClick(rpcEvt, e); }} />}
                        {trainEvt && <span style={{ width: 5, height: 5, borderRadius: '50%', background: EVENT_COLORS.training.border, display: 'block' }} title={trainEvt.label} onClick={e => { e.stopPropagation(); onEventClick(trainEvt, e); }} />}
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

// ── MONTHLY VIEW ──────────────────────────────────────────────────────────
function MonthlyView({ date, events, onEventClick, onDayClick }) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end   = endOfWeek(endOfMonth(date),   { weekStartsOn: 1 });
  const days  = eachDayOfInterval({ start, end });

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--color-bg)' }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>{d}</div>
        ))}
      </div>
      {/* Weeks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {days.map((day, idx) => {
          const ds = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsForDate(events, ds);
          const inMonth = isSameMonth(day, date);
          return (
            <div
              key={ds}
              onClick={() => onDayClick && onDayClick(day)}
              style={{
                minHeight: 90, padding: '4px 6px',
                borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
                background: !inMonth ? 'var(--color-bg)' : isToday(day) ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isToday(day) ? 700 : 400,
                color: !inMonth ? 'var(--color-text-hint)' : isToday(day) ? 'var(--color-primary)' : 'var(--color-text)',
                marginBottom: 3,
              }}>
                {format(day, 'd')}
              </div>
              {dayEvents.slice(0, 3).map((ev, i) => (
                <EventChip key={i} event={ev} onEventClick={onEventClick} />
              ))}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--color-text-hint)', marginTop: 2 }}>+{dayEvents.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WEEKLY VIEW ───────────────────────────────────────────────────────────
function WeeklyView({ date, events, onEventClick, onDayClick }) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days  = eachDayOfInterval({ start, end: addDays(start, 6) });

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--color-bg)' }}>
        {days.map(day => (
          <div key={day.toISOString()}
            onClick={() => onDayClick && onDayClick(day)}
            style={{
              padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
              borderBottom: '1px solid var(--color-border)',
              borderRight: isSameDay(day, days[6]) ? 'none' : '1px solid var(--color-border)',
              background: isToday(day) ? 'var(--color-primary-bg)' : '',
            }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>{format(day, 'EEE')}</div>
            <div style={{
              fontSize: 18, fontWeight: 600,
              color: isToday(day) ? 'var(--color-primary)' : 'var(--color-text)',
            }}>{format(day, 'd')}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {days.map((day, idx) => {
          const ds = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsForDate(events, ds);
          return (
            <div key={ds} style={{
              minHeight: 200, padding: '8px 6px',
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

// ── DAILY VIEW ────────────────────────────────────────────────────────────
function DailyView({ date, events, onEventClick }) {
  const ds = format(date, 'yyyy-MM-dd');
  const dayEvents = eventsForDate(events, ds);

  return (
    <div className="card" style={{ minHeight: 300 }}>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>{format(date, 'EEEE, d MMMM yyyy')}</div>
      {dayEvents.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events on this day.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dayEvents.map((ev, i) => (
            <div
              key={i}
              onClick={e => onEventClick(ev, e)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 'var(--radius)',
                background: EVENT_COLORS[ev.type].bg,
                border: `1px solid ${EVENT_COLORS[ev.type].border}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18 }}>
                {ev.type === 'race' ? '🏃' : ev.type === 'rpc' ? '📦' : '📋'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: EVENT_COLORS[ev.type].text }}>{ev.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {ev.type === 'race' ? 'Race' : ev.type === 'rpc' ? 'Race Pack Collection' : 'Training'}
                  {ev.plan?.plan_time && ` · ${ev.plan.plan_time}`}
                </div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-hint)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      {[
        { type: 'race',     label: 'Race' },
        { type: 'rpc',      label: 'Race Pack Collection' },
        { type: 'training', label: 'Training' },
      ].map(({ type, label }) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: EVENT_COLORS[type].border, display: 'inline-block' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main CalendarPage ─────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('monthly');
  const [date, setDate] = useState(new Date());
  const [races, setRaces] = useState([]);
  const [training, setTraining] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [defaultDate, setDefaultDate] = useState('');

  // Detail popup state
  const [popup, setPopup] = useState(null); // { plan, rect }

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.getRaces(), api.getTraining()]);
      setRaces(r);
      setTraining(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const events = buildEvents(races, training);

  // Navigate prev/next based on view
  const navPrev = () => {
    if (view === 'yearly')  setDate(d => subYears(d, 1));
    if (view === 'monthly') setDate(d => subMonths(d, 1));
    if (view === 'weekly')  setDate(d => subWeeks(d, 1));
    if (view === 'daily')   setDate(d => subDays(d, 1));
  };
  const navNext = () => {
    if (view === 'yearly')  setDate(d => addYears(d, 1));
    if (view === 'monthly') setDate(d => addMonths(d, 1));
    if (view === 'weekly')  setDate(d => addWeeks(d, 1));
    if (view === 'daily')   setDate(d => addDays(d, 1));
  };

  const title = () => {
    if (view === 'yearly')  return format(date, 'yyyy');
    if (view === 'monthly') return format(date, 'MMMM yyyy');
    if (view === 'weekly') {
      const s = startOfWeek(date, { weekStartsOn: 1 });
      const e = addDays(s, 6);
      return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
    }
    return format(date, 'EEEE, d MMMM yyyy');
  };

  const handleEventClick = (event, e) => {
    if (event.type === 'race' || event.type === 'rpc') {
      navigate(`/races/${event.id}`);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopup({ plan: event.plan, rect });
    }
  };

  const handleDayClick = (day) => {
    if (view === 'yearly' || view === 'monthly' || view === 'weekly') {
      setDate(day);
      setView('daily');
    }
  };

  const handleAddClick = () => {
    setDefaultDate(format(view === 'daily' ? date : new Date(), 'yyyy-MM-dd'));
    setEditPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = () => {
    setEditPlan(popup.plan);
    setPopup(null);
    setShowForm(true);
  };

  const handleDeletePlan = async () => {
    if (!confirm(`Delete "${popup.plan.name}"?`)) return;
    await api.deleteTraining(popup.plan.id);
    setPopup(null);
    loadData();
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title">Calendar</h1>
        <button onClick={handleAddClick} className="btn btn-primary btn-sm">
          <i className="ti ti-plus" /> Add training plan
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* View switcher */}
        <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 2, gap: 2 }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: view === v ? 'var(--color-surface)' : 'transparent',
              color: view === v ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{VIEW_LABELS[v]}</button>
          ))}
        </div>

        {/* Prev / Title / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
          <button onClick={navPrev} className="btn btn-ghost btn-sm"><i className="ti ti-chevron-left" /></button>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 160, textAlign: 'center' }}>{title()}</span>
          <button onClick={navNext} className="btn btn-ghost btn-sm"><i className="ti ti-chevron-right" /></button>
        </div>

        {/* Today */}
        <button onClick={() => setDate(new Date())} className="btn btn-secondary btn-sm">Today</button>
      </div>

      <div style={{ marginBottom: 12 }}><Legend /></div>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', padding: 40 }}>Loading…</div>
      ) : (
        <>
          {view === 'yearly'  && <YearlyView  date={date} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />}
          {view === 'monthly' && <MonthlyView date={date} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />}
          {view === 'weekly'  && <WeeklyView  date={date} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />}
          {view === 'daily'   && <DailyView   date={date} events={events} onEventClick={handleEventClick} />}
        </>
      )}

      {/* Training detail popup */}
      {popup && (
        <TrainingPopup
          plan={popup.plan}
          anchorRect={popup.rect}
          onEdit={handleEditPlan}
          onDelete={handleDeletePlan}
          onClose={() => setPopup(null)}
        />
      )}

      {/* Training form modal */}
      {showForm && (
        <TrainingModal
          plan={editPlan}
          races={races}
          defaultDate={defaultDate}
          onSave={() => { setShowForm(false); loadData(); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  format, addMonths, subMonths, addWeeks, subWeeks,
  addDays, subDays, addYears, subYears,
  isSameMonth, isToday, parseISO, getYear, eachDayOfInterval,
} from 'date-fns';
import { api } from '../lib/api.js';

// ── Constants ─────────────────────────────────────────────────────────────
const VIEWS = ['yearly', 'monthly', 'weekly', 'daily'];
const VIEW_LABELS = { yearly: 'Year', monthly: 'Month', weekly: 'Week', daily: 'Day' };

const EVENT_COLORS = {
  race:     { bg: '#dbeafe', border: '#3b82f6', text: '#1d40b0' },
  registration: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  rpc:      { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  training: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
};

function eventIcon(type) {
  if (type === 'race') return '🏃';
  if (type === 'registration') return '📝';
  if (type === 'rpc') return '📦';
  return '📋';
}

// ── Responsive hook ───────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return w;
}

// ── Sort key for ordering events by time ──────────────────────────────────
// Race flag-off → RPC time → training time → type order → name
function eventSortKey(ev) {
  const timeStr = ev.time || '';
  // Parse HH:MM times to minutes for sorting; non-time strings sort after
  const timeMin = /^\d{1,2}:\d{2}/.test(timeStr)
    ? parseInt(timeStr) * 60 + parseInt(timeStr.split(':')[1])
    : 9999;
  const typeOrder = { registration: 0, race: 1, rpc: 2, training: 3 };
  return [timeMin, typeOrder[ev.type] ?? 3, ev.label];
}

function sortedEvents(events) {
  return [...events].sort((a, b) => {
    const [am, at, al] = eventSortKey(a);
    const [bm, bt, bl] = eventSortKey(b);
    if (am !== bm) return am - bm;
    if (at !== bt) return at - bt;
    return al < bl ? -1 : al > bl ? 1 : 0;
  });
}

// ── Build event list from races + training ────────────────────────────────
function buildEvents(races, training) {
  const events = [];
  races.forEach(r => {
    if (r.race_date) {
      events.push({
        type: 'race',
        date: r.race_date.slice(0, 10),
        label: r.event_name,
        id: r.id,
        time: r.flag_off_time || '',
        race: r,
      });
    }
    if (r.status === 'upcoming' && r.registration_datetime) {
      const registrationDateTime = String(r.registration_datetime).replace(' ', 'T');
      events.push({
        type: 'registration',
        date: registrationDateTime.slice(0, 10),
        label: `Registration: ${r.event_name}`,
        id: r.id,
        time: registrationDateTime.slice(11, 16),
        race: r,
      });
    }
    if (r.rpc_date_start) {
      const label = `RPC: ${r.event_name}`;
      const startDs = r.rpc_date_start.slice(0, 10);
      const endDs   = r.rpc_date_end ? r.rpc_date_end.slice(0, 10) : startDs;

      // Generate one event for every day in the RPC window
      const rangeDays = eachDayOfInterval({
        start: parseISO(startDs),
        end:   parseISO(endDs),
      });

      rangeDays.forEach((day, idx) => {
        const ds = format(day, 'yyyy-MM-dd');
        const isFirst = idx === 0;
        const isLast  = idx === rangeDays.length - 1;
        const dayLabel = rangeDays.length === 1
          ? label
          : isFirst ? `${label} (start)`
          : isLast  ? `${label} (end)`
          : label;

        events.push({
          type: 'rpc',
          date: ds,
          label: dayLabel,
          id: r.id,
          time: r.rpc_time || '',
          race: r,
        });
      });
    }
  });
  training.forEach(t => {
    events.push({
      type: 'training',
      date: t.plan_date.slice(0, 10),
      label: t.name,
      id: t.id,
      time: t.plan_time || '',
      plan: t,
    });
  });
  return events;
}

function eventsForDate(events, dateStr) {
  return sortedEvents(events.filter(e => e.date === dateStr));
}

// ── Shared chip ───────────────────────────────────────────────────────────
function EventChip({ event, onEventClick }) {
  const c = EVENT_COLORS[event.type];
  return (
    <span
      onClick={e => { e.stopPropagation(); onEventClick(event, e); }}
      title={event.label + (event.time ? ` · ${event.time}` : '')}
      style={{
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
      }}
    >
      {eventIcon(event.type)}{' '}
      {event.label}
    </span>
  );
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
  const [search, setSearch] = useState(() => {
    if (plan?.race_id) {
      const r = races.find(r => r.id === plan.race_id);
      return r?.event_name || '';
    }
    return '';
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setDirty(true); };

  const confirmClose = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard and close?')) return;
    onClose();
  };

  const filteredRaces = races.filter(r =>
    r.event_name.toLowerCase().includes(search.toLowerCase())
  );

  const submit = async e => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      plan?.id ? await api.updateTraining(plan.id, form) : await api.createTraining(form);
      onSave();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && confirmClose()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{plan?.id ? 'Edit training plan' : 'Add training plan'}</h2>
          <button onClick={confirmClose} className="btn btn-ghost btn-sm"><i className="ti ti-x" /></button>
        </div>
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Long run 30 km" required />
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
              onChange={e => { setSearch(e.target.value); if (!e.target.value) { setForm(f => ({ ...f, race_id: '' })); setDirty(true); } }}
              placeholder="Search races…"
              style={{ marginBottom: 4 }}
            />
            {search && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', maxHeight: 160, overflowY: 'auto', background: 'var(--color-surface)' }}>
                <div
                  onClick={() => { setForm(f => ({ ...f, race_id: '' })); setSearch(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >— None</div>
                {filteredRaces.map(r => (
                  <div
                    key={r.id}
                    onClick={() => { setForm(f => ({ ...f, race_id: r.id })); setSearch(r.event_name); setDirty(true); }}
                    style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', background: form.race_id === r.id ? 'var(--color-primary-bg)' : '', color: form.race_id === r.id ? 'var(--color-primary)' : '' }}
                    onMouseEnter={e => { if (form.race_id !== r.id) e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { if (form.race_id !== r.id) e.currentTarget.style.background = ''; }}
                  >
                    <div style={{ fontWeight: 500 }}>{r.event_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{r.race_date?.slice(0, 10)}</div>
                  </div>
                ))}
                {filteredRaces.length === 0 && <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--color-text-hint)' }}>No races found</div>}
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
            <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Details, targets, gear…" style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
            <button type="button" onClick={confirmClose} className="btn btn-secondary">Cancel</button>
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

  // On mobile (< 480px) → bottom sheet; on desktop → anchored popup
  const isMobile = window.innerWidth < 480;

  const popupStyle = isMobile ? {
    position: 'fixed',
    left: 0, right: 0, bottom: 0,
    zIndex: 600,
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
    borderRadius: '16px 16px 0 0',
    padding: 20,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
  } : {
    position: 'fixed',
    zIndex: 600,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    padding: 16,
    minWidth: 260,
    maxWidth: 340,
    maxHeight: '60vh',
    overflowY: 'auto',
    top: anchorRect ? Math.min(anchorRect.bottom + 6, window.innerHeight - 320) : '50%',
    left: anchorRect ? Math.min(anchorRect.left, window.innerWidth - 360) : '50%',
  };

  return (
    <>
      {/* Backdrop on mobile */}
      {isMobile && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.4)' }} />
      )}
      <div ref={ref} style={popupStyle}>
        {/* Drag handle on mobile */}
        {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '0 auto 16px' }} />}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1, marginRight: 8 }}>{plan.name}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', flexShrink: 0 }}>
            <i className="ti ti-x" style={{ fontSize: 14 }} />
          </button>
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
    </>
  );
}

// ── YEARLY VIEW ───────────────────────────────────────────────────────────
function YearlyView({ date, events, onEventClick, onDayClick }) {
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

// ── MONTHLY VIEW ──────────────────────────────────────────────────────────
function MonthlyView({ date, events, onEventClick, onDayClick }) {
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
            ? ['M','T','W','T','F','S','S']
            : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
          ).map((d, i) => (
            <div key={i} style={{
              padding: isMobile ? '6px 2px' : '8px 4px',
              textAlign: 'center',
              fontSize: isMobile ? 10 : 11,
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
                  minHeight: isMobile ? 44 : 80,
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
                    width: isMobile ? 24 : 'auto',
                    height: isMobile ? 24 : 'auto',
                    lineHeight: isMobile ? '24px' : 'normal',
                    textAlign: 'center',
                    fontSize: isMobile ? 12 : 12,
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
                    {dayEvents.slice(0, 2).map((ev, i) => (
                      <EventChip key={i} event={ev} onEventClick={onEventClick} />
                    ))}
                    {dayEvents.length > 2 && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-hint)', paddingLeft: 2 }}>
                        +{dayEvents.length - 2}
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

// ── WEEKLY VIEW ───────────────────────────────────────────────────────────
function WeeklyView({ date, events, onEventClick, onDayClick }) {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--color-bg)' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
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

// ── DAILY VIEW ────────────────────────────────────────────────────────────
function DailyView({ date, events, onEventClick }) {
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

// ── Legend ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {[
        { type: 'race',     label: 'Race' },
        { type: 'registration', label: 'Registration' },
        { type: 'rpc',      label: 'Race Pack' },
        { type: 'training', label: 'Training' },
      ].map(({ type, label }) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: EVENT_COLORS[type].border, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── View switcher (compact on mobile) ────────────────────────────────────
function ViewSwitcher({ view, setView }) {
  return (
    <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 2, gap: 2, flexShrink: 0 }}>
      {VIEWS.map(v => (
        <button
          key={v}
          onClick={() => setView(v)}
          style={{
            padding: '5px 8px',
            borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            background: view === v ? 'var(--color-surface)' : 'transparent',
            color: view === v ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  );
}

// ── Main CalendarPage ─────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState(() => {
    return sessionStorage.getItem('cal_view') || 'monthly';
  });
  const [date, setDate] = useState(() => {
    const saved = sessionStorage.getItem('cal_date');
    return saved ? new Date(saved) : new Date();
  });

  // Persist whenever view or date changes
  useEffect(() => { sessionStorage.setItem('cal_view', view); }, [view]);
  useEffect(() => { sessionStorage.setItem('cal_date', date.toISOString()); }, [date]);
  const [races, setRaces] = useState([]);
  const [training, setTraining] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [defaultDate, setDefaultDate] = useState('');
  const [popup, setPopup] = useState(null);

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
      return `${format(s, 'd MMM')} – ${format(addDays(s, 6), 'd MMM yyyy')}`;
    }
    return format(date, 'd MMM yyyy');
  };

  const handleEventClick = (event, e) => {
    if (event.type === 'race' || event.type === 'registration' || event.type === 'rpc') {
      navigate(`/races/${event.id}`, { state: { from: 'calendar' } });
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopup({ plan: event.plan, rect });
    }
  };

  const handleDayClick = day => {
    setDate(day);
    setView('daily');
  };

  const handleAddClick = () => {
    setDefaultDate(format(view === 'daily' ? date : new Date(), 'yyyy-MM-dd'));
    setEditPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = () => { setEditPlan(popup.plan); setPopup(null); setShowForm(true); };
  const handleDeletePlan = async () => {
    if (!confirm(`Delete "${popup.plan.name}"?`)) return;
    await api.deleteTraining(popup.plan.id);
    setPopup(null);
    loadData();
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <h1 className="page-title">Calendar</h1>
        <button onClick={handleAddClick} className="btn btn-primary btn-sm">
          <i className="ti ti-plus" /> <span className="tablet-up" style={{ display: 'contents' }}>Add training plan</span>
        </button>
      </div>

      {/* Toolbar: view switcher + nav + today */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <ViewSwitcher view={view} setView={setView} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', minWidth: 0 }}>
          <button onClick={navPrev} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px', flexShrink: 0 }}>
            <i className="ti ti-chevron-left" />
          </button>
          <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title()}</span>
          <button onClick={navNext} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px', flexShrink: 0 }}>
            <i className="ti ti-chevron-right" />
          </button>
        </div>
        <button onClick={() => setDate(new Date())} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>Today</button>
      </div>

      <div style={{ marginBottom: 10 }}><Legend /></div>

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

      {popup && (
        <TrainingPopup
          plan={popup.plan}
          anchorRect={popup.rect}
          onEdit={handleEditPlan}
          onDelete={handleDeletePlan}
          onClose={() => setPopup(null)}
        />
      )}

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

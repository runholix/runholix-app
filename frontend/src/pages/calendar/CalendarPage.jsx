import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfWeek,
  format, addMonths, subMonths, addWeeks, subWeeks,
  addDays, subDays, addYears, subYears,
  parseISO, eachDayOfInterval,
} from 'date-fns';
import { api } from '../../lib/api.js';
import WeeklyView from "./WeeklyView.jsx";
import DailyView from "./DailyView.jsx";
import {sortedEvents} from "../../lib/utils.js";
import TrainingModal from "./TrainingModal.jsx";
import TrainingPopup from "./TrainingPopUp.jsx";
import MonthlyView from "./MonthlyView.jsx";
import YearlyView from "./YearlyView.jsx";
import useWindowWidth from "../../hooks/useWindowWidth.jsx";
import ViewSwitcher from "./ViewSwitcher.jsx";
import Legend from "./Legend.jsx";
import CalendarPagination from "./CalendarPagination.jsx";

export const EVENT_COLORS = {
  race:     { bg: '#dbeafe', border: '#3b82f6', text: '#1d40b0' },
  registration: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  rpc:      { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  training: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
};

export function eventIcon(type) {
  if (type === 'race') return '🏃';
  if (type === 'registration') return '📝';
  if (type === 'rpc') return '📦';
  return '📋';
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

export function eventsForDate(events, dateStr) {
  return sortedEvents(events.filter(e => e.date === dateStr));
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
  const [error, setError] = useState('');
  const [errorDelete, setErrorDelete] = useState('');
  const viewedYear = date.getFullYear();

  const w = useWindowWidth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([
        api.getRaceCalendar(viewedYear),
        api.getTraining({ year: viewedYear }),
      ]);
      setRaces(r || []);
      setTraining(t || []);
    } catch (err) {
      console.error(err);
      setError(`Failed to load calendar data: ${err?.status || ''} ${err.message}`)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [viewedYear]);

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

  const handleMonthClick = day => {
    setDate(day);
    setView('monthly');
  };

  const handleAddClick = () => {
    setDefaultDate(format(view === 'daily' ? date : new Date(), 'yyyy-MM-dd'));
    setEditPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = () => { setEditPlan(popup.plan); setPopup(null); setShowForm(true); };
  const handleDeletePlan = async () => {
    if (!confirm(`Delete "${popup.plan.name}"?`)) return;
    try {
      await api.deleteTraining(popup.plan.id);
      setPopup(null);
      setErrorDelete('');
      await loadData();
    } catch (err) {
      console.error(err);
      setErrorDelete(`Failed to delete training: ${err?.status || ''} ${err.message}`);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1440 }}>
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
          {w >= 500 && (
            <CalendarPagination navPrev={navPrev} navNext={navNext} title={title} />
          )}
        </div>
        <button onClick={() => setDate(new Date())} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>Today</button>
      </div>

      {w < 500 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <CalendarPagination navPrev={navPrev} navNext={navNext} title={title} />
          </div>
      )}

      <div style={{ marginBottom: 10 }}><Legend /></div>

      {loading ? (
          <div className="alert-info">Loading...</div>
      ) : error ? (
          <div className="alert-error">{error}</div>
      ) : (
        <>
          {errorDelete && <div className="alert-error">{errorDelete}</div>}
          {view === 'yearly'  && <YearlyView  date={date} events={events} onEventClick={handleEventClick} onDayClick={handleMonthClick} />}
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

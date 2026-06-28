import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import Field from "../../../components/Field.jsx";
import FacilitySection from "./FacilitySection.jsx";
import MandatoryItemsSection from "./MandatoryItemsSection.jsx";
import EventInfoSection from "./EventInfoSection.jsx";
import RegistrationSection from "./RegistrationSection.jsx";
import DistanceCategorySection from "./DistanceCategorySection.jsx";
import RacePackCollectionSection from "./RacePackCollectionSection.jsx";
import ResultSection from "./ResultSection.jsx";
import { useAuth } from "../../../hooks/useAuth.jsx";
import TabButton from "../../../components/TabButton.jsx";
import Alert from "../../../components/Alert.jsx";

// ── Default state ─────────────────────────────────────────────────────────
const EMPTY = {
  event_name: '', race_date: '', registration_datetime: '', flag_off_time: '', cutoff_time: '',
  route_file_path: '', route_file_name: '',
  location: '', city: '', country: '', website_url: '', instagram_url: '',
  timezone: '',
  itra_url: '',
  status: 'registered', registration_fee: '', registration_currency: 'USD',
  bib_number: '', bib_name: '', jersey_size: '',
  registered_email: '', registered_phone: '',
  confirmation_number: '', finish_time_target: '',
  attachment_path: '', attachment_name: '',
  qualification: '',
  distance_km: '', distance_label: '', race_type: 'road', category: '',
  elevation_gain_req_m: '', itra_point: '',
  finish_time: '', gun_time: '',
  overall_place: '', overall_total: '', gender_place: '', gender_total: '',
  age_group_place: '', age_group_total: '', age_group_label: '',
  heart_rate_avg: '', heart_rate_max: '', actual_distance_km: '', elevation_gain_m: '',
  weather_temp_c: '', weather_condition: '',
  notes: '', race_report: '', results_url: '', certificate_url: '',
  strava_url: '', result_file_path: '', result_file_name: '',
  facilities: [],
  rpc_date_start: '', rpc_date_end: '', rpc_time: '', rpc_location: '',
  rpc_status: 'not_collected',
  rpc_attachment_path: '', rpc_attachment_name: '',
  rpc_notes: '',
  mandatory_items: [],
};

// ── Main form ─────────────────────────────────────────────────────────────
export default function RaceFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const userId = user.id;
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    ...EMPTY,
    timezone: user?.timezone || 'UTC'
  });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [originalRaceDate, setOriginalRaceDate] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  // Track files uploaded this session so we can delete them if user cancels
  const pendingUploads = useRef([]);
  // Track existing files removed but not yet saved — delete from backend only on save
  const pendingDeletions = useRef([]);

  const trackUpload = (type, filePath) => {
    if (!filePath) return;
    const filename = filePath.split('/').pop();
    pendingUploads.current.push({ type, filename });
  };

  const clearPendingUploads = () => { pendingUploads.current = []; };

  const deletePendingUploads = async () => {
    for (const { type, filename } of pendingUploads.current) {
      try {
        if (type === 'attachment' || type === 'rpc_attachment') {
          await api.deleteAttachment(userId, filename);
        } else {
          await api.deleteRouteFile(userId, filename);
        }
      } catch { /* best-effort */ }
    }
    pendingUploads.current = [];
  };

  const executePendingDeletions = async () => {
    for (const { type, filename } of pendingDeletions.current) {
      try {
        if (type === 'attachment' || type === 'rpc_attachment') {
          await api.deleteAttachment(userId, filename);
        } else {
          await api.deleteRouteFile(userId, filename);
        }
      } catch { /* best-effort */ }
    }
    pendingDeletions.current = [];
  };

  // Smart remove: if file was uploaded this session → delete now; if existing → defer to save
  const makeOnClear = (type, currentPath, clearFn) => async () => {
    const label = type === 'attachment' || type === 'rpc_attachment' ? 'PDF' : 'file';
    const isPending = pendingUploads.current.some(u => u.filename === currentPath?.split('/')?.pop());

    if (isPending) {
      // Newly uploaded — delete immediately from backend
      if (!window.confirm(`Remove this ${label}? It will be deleted immediately.`)) return;
      const filename = currentPath.split('/').pop();
      if (type === 'attachment' || type === 'rpc_attachment') {
        api.deleteAttachment(userId, filename).catch(() => {});
      } else {
        api.deleteRouteFile(userId, filename).catch(() => {});
      }
      // Remove from pendingUploads
      pendingUploads.current = pendingUploads.current.filter(u => u.filename !== filename);
    } else {
      // Existing file — only delete from backend when user clicks Save
      if (!window.confirm(`Remove this ${label}? It will be deleted when you save changes.`)) return;
      if (currentPath) {
        pendingDeletions.current.push({ type, filename: currentPath.split('/').pop() });
      }
    }
    setDirty(true);
    clearFn();
  };

  useEffect(() => {
    if (!isEdit) return;
    api.getRace(id).then(race => {
      const raceDate = race.race_date?.slice(0,10) || '';
      setOriginalRaceDate(raceDate);
      setForm({
        event_name: race.event_name || '', race_date: raceDate,
        registration_datetime: race.registration_datetime ? String(race.registration_datetime).replace(' ', 'T').slice(0,16) : '',
        flag_off_time: race.flag_off_time || '', cutoff_time: race.cutoff_time || '',
        route_file_path: race.route_file_path || '', route_file_name: race.route_file_name || '',
        location: race.location || '', city: race.city || '', country: race.country || '',
        website_url: race.website_url || '', instagram_url: race.instagram_url || '', timezone: race.timezone || user?.timezone || 'UTC', itra_url: race.itra_url || '',
        status: race.status || 'registered',
        registration_fee: race.registration_fee || '', registration_currency: race.registration_currency || 'USD',
        bib_number: race.bib_number || '', bib_name: race.bib_name || '',
        jersey_size: race.jersey_size || '',
        registered_email: race.registered_email || '', registered_phone: race.registered_phone || '',
        confirmation_number: race.confirmation_number || '', finish_time_target: race.finish_time_target || '',
        attachment_path: race.attachment_path || '', attachment_name: race.attachment_name || '',
        qualification: race.qualification || '',
        distance_km: race.distance_km || '', distance_label: race.distance_label || '',
        race_type: race.race_type || 'road', category: race.category || '',
        elevation_gain_req_m: race.elevation_gain_req_m || '', itra_point: race.itra_point || '',
        finish_time: race.finish_time || '', gun_time: race.gun_time || '',
        overall_place: race.overall_place || '', overall_total: race.overall_total || '',
        gender_place: race.gender_place || '', gender_total: race.gender_total || '',
        age_group_place: race.age_group_place || '', age_group_total: race.age_group_total || '',
        age_group_label: race.age_group_label || '',
        heart_rate_avg: race.heart_rate_avg || '', heart_rate_max: race.heart_rate_max || '',
        actual_distance_km: race.actual_distance_km || '',
        elevation_gain_m: race.elevation_gain_m || '',
        weather_temp_c: race.weather_temp_c || '', weather_condition: race.weather_condition || '',
        notes: race.notes || '', race_report: race.race_report || '',
        results_url: race.results_url || '', certificate_url: race.certificate_url || '',
        strava_url: race.strava_url || '',
        result_file_path: race.result_file_path || '', result_file_name: race.result_file_name || '',
        facilities: Array.isArray(race.facilities) ? race.facilities : [],
        rpc_date_start: race.rpc_date_start?.slice(0,10) || '',
        rpc_date_end: race.rpc_date_end?.slice(0,10) || '',
        rpc_time: race.rpc_time || '', rpc_location: race.rpc_location || '',
        rpc_status: race.rpc_status || 'not_collected',
        rpc_attachment_path: race.rpc_attachment_path || '',
        rpc_attachment_name: race.rpc_attachment_name || '',
        rpc_notes: race.rpc_notes || '',
        mandatory_items: Array.isArray(race.mandatory_items) ? race.mandatory_items : [],
      });
    }).catch((err) => {
      console.error(err);
      setError(`Failed to load race details: ${err?.status || ''} ${err.message}`);
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (key) => (e) => { setForm(f => ({ ...f, [key]: e.target.value })); setDirty(true); };
  const setVal = (key, val) => { setForm(f => ({ ...f, [key]: val })); setDirty(true); };

  const handleCancel = async (e) => {
    if (dirty && !window.confirm('You have unsaved changes. Discard and leave?')) {
      e.preventDefault();
      return;
    }
    // Delete only newly uploaded files — existing files are untouched on cancel
    await deletePendingUploads();
    // pendingDeletions are NOT executed — existing files stay on server
    pendingDeletions.current = [];
  };

  const isTrail = form.race_type === 'trail';
  const savedRaceDates = (() => {
    try {
      const dates = JSON.parse(localStorage.getItem('rt_race_date_list') || '[]');
      return Array.isArray(dates) ? dates : [];
    } catch {
      return [];
    }
  })();
  const raceDateExists = !!form.race_date
    && savedRaceDates.includes(form.race_date)
    && (!isEdit || form.race_date !== originalRaceDate);

  const submit = async (e) => {
    e.preventDefault();
    if (isTrail && !form.elevation_gain_req_m) { setError('Elevation gain is required for trail races'); return; }
    setError(''); setSaving(true);
    try {
      const race = isEdit ? await api.updateRace(id, form) : await api.createRace(form);
      setDirty(false);
      clearPendingUploads();
      await executePendingDeletions(); // now safe to delete existing files user removed
      navigate(`/races/${race.id}`);
    } catch (err) {
      console.error(err);
      window.scrollTo(0, 0);
      setError(`Failed to save: ${err?.status || ''} ${err?.message || ''}`);
      setSaving(false);
    }
  };

  const showResults = form.status === 'completed' || form.status === 'dnf';

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <Link onClick={handleCancel} to={isEdit ? `/races/${id}` : '/races'} style={{ fontSize:13, color:'var(--color-text-muted)', display:'inline-flex', alignItems:'center', gap:4, marginBottom:20 }}>
        <i className="ti ti-arrow-left" /> {isEdit ? 'Back to race' : 'Back to races'}
      </Link>
      <h1 className="page-title" style={{ marginBottom:24 }}>{isEdit ? 'Edit race' : 'Add new race'}</h1>

      {error && <div className="alert-error">{error}</div>}
      {loading && <div className="alert-info">Loading...</div>}

      <div style={{ marginBottom: 15 }}>
        <Alert type="warning" message="This is only a demo web which serves dummy data without any real server behind it. Do not store your data here, or else you will lose it on page refresh!" />
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')} icon="ti-info-circle">Info</TabButton>
            <TabButton active={activeTab === 'rpc'} onClick={() => setActiveTab('rpc')} icon="ti-package">RPC</TabButton>
            <TabButton active={activeTab === 'result'} onClick={() => setActiveTab('result')} icon="ti-chart-bar">Result</TabButton>
          </div>

          {activeTab === 'info' && (
            <>
              <EventInfoSection isTrail={isTrail} makeOnClear={makeOnClear} setVal={setVal} trackUpload={trackUpload} set={set} form={form} userId={userId} raceDateExists={raceDateExists} />
              <RegistrationSection isTrail={isTrail} makeOnClear={makeOnClear} set={set} setVal={setVal} form={form} userId={userId} />
              <DistanceCategorySection isTrail={isTrail} set={set} form={form} />
              <FacilitySection facilities={form.facilities} onChange={facs => setVal('facilities', facs)} />
            </>
          )}

          {activeTab === 'rpc' && (
            <>
              <RacePackCollectionSection setVal={setVal} set={set} makeOnClear={makeOnClear} form={form} userId={userId} trackUpload={trackUpload} />
              {isTrail && (
                <div style={{ marginTop:24 }}>
                  <MandatoryItemsSection items={form.mandatory_items} onChange={items => setVal('mandatory_items', items)} />
                </div>
              )}
            </>
          )}

          {activeTab === 'result' && (
            <>
              {showResults && (
                <ResultSection setVal={setVal} set={set} makeOnClear={makeOnClear} form={form} userId={userId} trackUpload={trackUpload} />
              )}

              <div className="form-section-title">Notes</div>
              <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:8 }}>
                <Field label="Quick notes">
                  <textarea value={form.notes} onChange={set('notes')} rows={3}
                    placeholder="Pre-race goals, logistics, reminders…" style={{ resize:'vertical' }} />
                </Field>
                <Field label="Race report">
                  <textarea value={form.race_report} onChange={set('race_report')} rows={6}
                    placeholder="How did it go? How did you feel at each km? What would you do differently?" style={{ resize:'vertical' }} />
                </Field>
              </div>
            </>
          )}

          {/* ── ACTIONS ────────────────────────────────────────────── */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24, paddingTop:20, borderTop:'1px solid var(--color-border)', flexWrap:'wrap' }}>
            <Link to={isEdit ? `/races/${id}` : '/races'} className="btn btn-secondary" onClick={handleCancel}>Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <i className={`ti ${saving ? 'ti-loader' : 'ti-check'}`} />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add race'}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}

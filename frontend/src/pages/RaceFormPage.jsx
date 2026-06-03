import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const EMPTY = {
  event_name: '', race_date: '', flag_off_time: '', cutoff_time: '',
  route_file_path: '', route_file_name: '',
  location: '', city: '', country: '', website_url: '',
  status: 'registered', registration_fee: '', registration_currency: 'USD',
  bib_number: '', bib_name: '', jersey_size: '',
  registered_email: '', registered_phone: '',
  confirmation_number: '', finish_time_target: '',
  attachment_path: '', attachment_name: '',
  distance_km: '', distance_label: '', race_type: 'road', category: '',
  finish_time: '', gun_time: '',
  overall_place: '', overall_total: '', gender_place: '', gender_total: '',
  age_group_place: '', age_group_total: '', age_group_label: '',
  heart_rate_avg: '', heart_rate_max: '', elevation_gain_m: '',
  weather_temp_c: '', weather_condition: '',
  notes: '', race_report: '', results_url: '', certificate_url: '',
  facilities: [],
  rpc_date_start: '', rpc_date_end: '', rpc_time: '', rpc_location: '',
  rpc_status: 'not_collected',
  rpc_attachment_path: '', rpc_attachment_name: '',
  rpc_notes: '',
};

function Field({ label, children, hint }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 2 }}>{hint}</span>}
    </div>
  );
}

// ── Route file uploader ───────────────────────────────────────────────────
function RouteUploader({ filePath, fileName, userId, onChange, onClear }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErr(''); setUploading(true);
    try {
      const res = await api.uploadRoute(file);
      onChange(res.route_file_path, res.route_file_name);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (filePath && fileName) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
        <i className="ti ti-file-vector" style={{ color: 'var(--color-primary)', fontSize: 18, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
        <a
          href={api.routeFileUrl(userId, filePath.split('/').pop(), fileName)}
          download={fileName}
          className="btn btn-ghost btn-sm"
          title="Download"
        >
          <i className="ti ti-download" />
        </a>
        <button type="button" onClick={onClear} className="btn btn-ghost btn-sm" title="Remove">
          <i className="ti ti-x" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".fit,.gpx,.kml" style={{ display: 'none' }} onChange={handleFile} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()} disabled={uploading}>
        <i className="ti ti-upload" /> {uploading ? 'Uploading…' : 'Upload .fit / .gpx / .kml'}
      </button>
      {err && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{err}</div>}
    </div>
  );
}

// ── PDF attachment uploader ──────────────────────────────────────────────
function PdfUploader({ filePath, fileName, userId, onChange, onClear }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErr(''); setUploading(true);
    try {
      const res = await api.uploadAttachment(file);
      onChange(res.attachment_path, res.attachment_name);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (filePath && fileName) {
    const url = api.attachmentUrl(userId, filePath.split('/').pop());
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: viewing ? 8 : 0 }}>
          <i className="ti ti-file-type-pdf" style={{ color: 'var(--color-danger)', fontSize: 18, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
          <button type="button" onClick={() => setViewing(v => !v)} className="btn btn-ghost btn-sm" title={viewing ? 'Hide' : 'View PDF'}>
            <i className={`ti ${viewing ? 'ti-eye-off' : 'ti-eye'}`} />
          </button>
          <button type="button" onClick={onClear} className="btn btn-ghost btn-sm" title="Remove">
            <i className="ti ti-x" />
          </button>
        </div>
        {viewing && (
          <iframe
            src={url}
            title="Attachment preview"
            style={{ width: '100%', height: 500, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', display: 'block' }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFile} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()} disabled={uploading}>
        <i className="ti ti-upload" /> {uploading ? 'Uploading…' : 'Upload PDF'}
      </button>
      {err && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{err}</div>}
    </div>
  );
}

// ── Facility section ─────────────────────────────────────────────────────
const DEFAULT_FACILITIES = [
  'Finisher medal',
  'BIB timing chip',
  'Race jersey',
  'Finisher certificate',
  'Finisher jersey',
  'Finisher cap',
];

function FacilitySection({ facilities, onChange }) {
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const toggle = (name) => {
    const exists = facilities.find(f => f.name === name);
    if (exists) {
      onChange(facilities.filter(f => f.name !== name));
    } else {
      onChange([...facilities, { name, custom: false }]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (facilities.find(f => f.name === trimmed)) return;
    onChange([...facilities, { name: trimmed, custom: true }]);
    setCustomInput('');
    setShowCustomInput(false);
  };

  const removeCustom = (name) => onChange(facilities.filter(f => f.name !== name));

  const isChecked = (name) => !!facilities.find(f => f.name === name);
  const customItems = facilities.filter(f => f.custom);

  return (
    <>
      <div className="form-section-title">Facility</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 16px', marginBottom: 14 }}>
        {DEFAULT_FACILITIES.map(name => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius)', border: `1px solid ${isChecked(name) ? 'var(--color-primary)' : 'var(--color-border)'}`, background: isChecked(name) ? 'var(--color-primary-bg)' : 'var(--color-surface)', transition: 'all 0.15s' }}>
            <input
              type="checkbox"
              checked={isChecked(name)}
              onChange={() => toggle(name)}
              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: isChecked(name) ? 500 : 400, color: isChecked(name) ? 'var(--color-primary)' : 'var(--color-text)' }}>{name}</span>
          </label>
        ))}

        {/* Custom items */}
        {customItems.map(item => (
          <label key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)', transition: 'all 0.15s' }}>
            <input
              type="checkbox"
              checked={true}
              onChange={() => removeCustom(item.name)}
              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)', flex: 1 }}>{item.name}</span>
            <button type="button" onClick={() => removeCustom(item.name)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>
              <i className="ti ti-x" style={{ fontSize: 12 }} />
            </button>
          </label>
        ))}
      </div>

      {/* Add custom item */}
      {showCustomInput ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } if (e.key === 'Escape') setShowCustomInput(false); }}
            placeholder="Custom facility name…"
            autoFocus
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={addCustom}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowCustomInput(false); setCustomInput(''); }}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCustomInput(true)} style={{ marginBottom: 8 }}>
          <i className="ti ti-plus" /> Add custom item
        </button>
      )}
    </>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────
export default function RaceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState(EMPTY);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.me().then(u => setUserId(u.id)).catch(() => {});
    if (!isEdit) return;
    api.getRace(id).then(race => {
      setForm({
        event_name: race.event_name || '', race_date: race.race_date?.slice(0, 10) || '',
        flag_off_time: race.flag_off_time || '', cutoff_time: race.cutoff_time || '',
        route_file_path: race.route_file_path || '', route_file_name: race.route_file_name || '',
        location: race.location || '', city: race.city || '', country: race.country || '',
        website_url: race.website_url || '', status: race.status || 'registered',
        registration_fee: race.registration_fee || '', registration_currency: race.registration_currency || 'USD',
        bib_number: race.bib_number || '', bib_name: race.bib_name || '',
        jersey_size: race.jersey_size || '',
        registered_email: race.registered_email || '', registered_phone: race.registered_phone || '',
        confirmation_number: race.confirmation_number || '', finish_time_target: race.finish_time_target || '',
        attachment_path: race.attachment_path || '', attachment_name: race.attachment_name || '',
        distance_km: race.distance_km || '', distance_label: race.distance_label || '',
        race_type: race.race_type || 'road', category: race.category || '',
        finish_time: race.finish_time || '', gun_time: race.gun_time || '',
        overall_place: race.overall_place || '', overall_total: race.overall_total || '',
        gender_place: race.gender_place || '', gender_total: race.gender_total || '',
        age_group_place: race.age_group_place || '', age_group_total: race.age_group_total || '',
        age_group_label: race.age_group_label || '',
        heart_rate_avg: race.heart_rate_avg || '', heart_rate_max: race.heart_rate_max || '',
        elevation_gain_m: race.elevation_gain_m || '',
        weather_temp_c: race.weather_temp_c || '', weather_condition: race.weather_condition || '',
        notes: race.notes || '', race_report: race.race_report || '',
        results_url: race.results_url || '', certificate_url: race.certificate_url || '',
        facilities: Array.isArray(race.facilities) ? race.facilities : [],
        rpc_date_start: race.rpc_date_start?.slice(0,10) || '',
        rpc_date_end: race.rpc_date_end?.slice(0,10) || '',
        rpc_time: race.rpc_time || '', rpc_location: race.rpc_location || '',
        rpc_status: race.rpc_status || 'not_collected',
        rpc_attachment_path: race.rpc_attachment_path || '',
        rpc_attachment_name: race.rpc_attachment_name || '',
        rpc_notes: race.rpc_notes || '',
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setVal = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const race = isEdit ? await api.updateRace(id, form) : await api.createRace(form);
      navigate(`/races/${race.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="page" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>;

  const showResults = form.status === 'completed' || form.status === 'dnf';

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <Link to={isEdit ? `/races/${id}` : '/races'} style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        <i className="ti ti-arrow-left" /> {isEdit ? 'Back to race' : 'Back to races'}
      </Link>
      <h1 className="page-title" style={{ marginBottom: 24 }}>{isEdit ? 'Edit race' : 'Add new race'}</h1>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={submit}>
        <div className="card">

          {/* ── EVENT INFO ──────────────────────────────────────────── */}
          <div className="form-section-title" style={{ marginTop: 0 }}>Event info</div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Event name *</label>
            <input value={form.event_name} onChange={set('event_name')} placeholder="e.g. Jakarta Marathon 2024" required />
          </div>

          {/* Date + Status */}
          <div className="grid-form-2" style={{ marginBottom: 14 }}>
            <Field label="Race date *">
              <input type="date" value={form.race_date} onChange={set('race_date')} required />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set('status')}>
                <option value="registered">Registered</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="dnf">DNF</option>
                <option value="dns">DNS</option>
              </select>
            </Field>
          </div>

          {/* Flag off + Cut off */}
          <div className="grid-form-2" style={{ marginBottom: 14 }}>
            <Field label="Flag off time (HH:MM, optional)" hint="24-hour format e.g. 05:30">
              <input
                value={form.flag_off_time}
                onChange={set('flag_off_time')}
                placeholder="05:30"
                pattern="^([01]\d|2[0-3]):[0-5]\d$"
                title="HH:MM in 24-hour format"
              />
            </Field>
            <Field label="Cut off time * (e.g. 7h 30m)" hint="Total race time limit">
              <input
                value={form.cutoff_time}
                onChange={set('cutoff_time')}
                placeholder="7h 30m"
                pattern="^\d+h\s*\d+m$"
                title="Format: Xh Ym (e.g. 7h 30m)"
                required
              />
            </Field>
          </div>

          {/* Location */}
          <div className="grid-form-2" style={{ marginBottom: 14 }}>
            <Field label="City">
              <input value={form.city} onChange={set('city')} placeholder="Jakarta" />
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={set('country')} placeholder="Indonesia" />
            </Field>
            <Field label="Venue / location">
              <input value={form.location} onChange={set('location')} placeholder="Monas area" />
            </Field>
            <Field label="Race website URL">
              <input type="url" value={form.website_url} onChange={set('website_url')} placeholder="https://…" />
            </Field>
          </div>

          {/* Route file */}
          <Field label="Route file (optional — .fit / .gpx / .kml)">
            <RouteUploader
              filePath={form.route_file_path}
              fileName={form.route_file_name}
              userId={userId}
              onChange={(path, name) => { setVal('route_file_path', path); setVal('route_file_name', name); }}
              onClear={() => { setVal('route_file_path', ''); setVal('route_file_name', ''); }}
            />
          </Field>

          {/* ── REGISTRATION ────────────────────────────────────────── */}
          <div className="form-section-title">Registration</div>

          {/* Row 1: Bib + Name on BIB + Confirmation */}
          <div className="grid-form-3" style={{ marginBottom: 14 }}>
            <Field label="Bib number">
              <input value={form.bib_number} onChange={set('bib_number')} placeholder="1234" />
            </Field>
            <Field label="Name on BIB (optional)">
              <input value={form.bib_name} onChange={set('bib_name')} placeholder="JOHN DOE" />
            </Field>
            <Field label="Confirmation #">
              <input value={form.confirmation_number} onChange={set('confirmation_number')} />
            </Field>
          </div>

          {/* Row 2: Fee + Currency + Jersey size */}
          <div className="grid-form-3" style={{ marginBottom: 14 }}>
            <Field label="Fee">
              <input type="number" value={form.registration_fee} onChange={set('registration_fee')} placeholder="350000" step="0.01" />
            </Field>
            <Field label="Currency">
              <select value={form.registration_currency} onChange={set('registration_currency')}>
                {['IDR','USD','EUR','GBP','SGD','MYR','JPY','AUD'].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Jersey size (optional)">
              <select value={form.jersey_size} onChange={set('jersey_size')}>
                <option value="">—</option>
                {['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 3: Email + Phone + Finish time target */}
          <div className="grid-form-3" style={{ marginBottom: 14 }}>
            <Field label="Registered email *">
              <input type="email" value={form.registered_email} onChange={set('registered_email')}
                placeholder="you@example.com" required />
            </Field>
            <Field label="Registered phone *">
              <input type="tel" value={form.registered_phone} onChange={set('registered_phone')}
                placeholder="+62812345678" required />
            </Field>
            <Field label="Finish time target (optional)" hint="HH:MM:SS">
              <input value={form.finish_time_target} onChange={set('finish_time_target')}
                placeholder="04:30:00"
                pattern="^\d{1,2}:\d{2}:\d{2}$"
                title="HH:MM:SS format e.g. 04:30:00" />
            </Field>
          </div>

          {/* Attachment */}
          <Field label="Attachment (optional — PDF)">
            <PdfUploader
              filePath={form.attachment_path}
              fileName={form.attachment_name}
              userId={userId}
              onChange={(path, name) => { setVal('attachment_path', path); setVal('attachment_name', name); }}
              onClear={() => { setVal('attachment_path', ''); setVal('attachment_name', ''); }}
            />
          </Field>

          {/* ── DISTANCE & CATEGORY ─────────────────────────────────── */}
          <div className="form-section-title">Distance & category</div>
          <div className="grid-form-4" style={{ marginBottom: 16 }}>
            <Field label="Distance (km)">
              <input type="number" value={form.distance_km} onChange={set('distance_km')} placeholder="42.195" step="0.001" />
            </Field>
            <Field label="Distance label">
              <input value={form.distance_label} onChange={set('distance_label')} placeholder="Full Marathon" />
            </Field>
            <Field label="Race type">
              <select value={form.race_type} onChange={set('race_type')}>
                <option value="road">Road</option>
                <option value="trail">Trail</option>
                <option value="track">Track</option>
                <option value="virtual">Virtual</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Category / wave">
              <input value={form.category} onChange={set('category')} placeholder="Open Male" />
            </Field>
          </div>

          {/* ── FACILITY ────────────────────────────────────────────── */}
          <FacilitySection
            facilities={form.facilities}
            onChange={facs => setVal('facilities', facs)}
          />

          {/* ── RACE PACK COLLECTION ────────────────────────────────── */}
          <div className="form-section-title">Race Pack Collection</div>

          {/* Date range */}
          <div className="grid-form-2" style={{ marginBottom: 14 }}>
            <Field label="Collection date start">
              <input type="date" value={form.rpc_date_start} onChange={set('rpc_date_start')} />
            </Field>
            <Field label="Collection date end">
              <input type="date" value={form.rpc_date_end} onChange={set('rpc_date_end')} />
            </Field>
          </div>

          {/* Time + Location + Status */}
          <div className="grid-form-3" style={{ marginBottom: 14 }}>
            <Field label="Collection time" hint="e.g. 09:00–17:00 or Morning only">
              <input value={form.rpc_time} onChange={set('rpc_time')} placeholder="09:00 – 17:00" />
            </Field>
            <Field label="Location">
              <input value={form.rpc_location} onChange={set('rpc_location')} placeholder="Hall A, Expo Center" />
            </Field>
            <Field label="Collection status">
              <select value={form.rpc_status} onChange={set('rpc_status')}>
                <option value="not_collected">Not collected</option>
                <option value="collected">Collected</option>
              </select>
            </Field>
          </div>

          {/* RPC Attachment */}
          <div style={{ marginBottom: 14 }}>
            <Field label="Attachment (optional — PDF)">
              <PdfUploader
                filePath={form.rpc_attachment_path}
                fileName={form.rpc_attachment_name}
                userId={userId}
                onChange={(path, name) => { setVal('rpc_attachment_path', path); setVal('rpc_attachment_name', name); }}
                onClear={() => { setVal('rpc_attachment_path', ''); setVal('rpc_attachment_name', ''); }}
              />
            </Field>
          </div>

          {/* RPC Notes */}
          <Field label="Notes">
            <textarea
              value={form.rpc_notes}
              onChange={set('rpc_notes')}
              rows={3}
              placeholder="Collection instructions, what to bring, parking info…"
              style={{ resize: 'vertical' }}
            />
          </Field>

          {/* ── RESULTS ─────────────────────────────────────────────── */}
          {showResults && (<>
            <div className="form-section-title">Results</div>
            <div className="grid-form-2" style={{ marginBottom: 16 }}>
              <Field label="Finish time (chip) HH:MM:SS">
                <input value={form.finish_time} onChange={set('finish_time')} placeholder="04:32:15" />
              </Field>
              <Field label="Gun time HH:MM:SS">
                <input value={form.gun_time} onChange={set('gun_time')} placeholder="04:34:01" />
              </Field>
            </div>
            <div className="grid-form-6" style={{ marginBottom: 16 }}>
              <Field label="Overall place"><input type="number" value={form.overall_place} onChange={set('overall_place')} /></Field>
              <Field label="Overall total"><input type="number" value={form.overall_total} onChange={set('overall_total')} /></Field>
              <Field label="Gender place"><input type="number" value={form.gender_place} onChange={set('gender_place')} /></Field>
              <Field label="Gender total"><input type="number" value={form.gender_total} onChange={set('gender_total')} /></Field>
              <Field label="Age group place"><input type="number" value={form.age_group_place} onChange={set('age_group_place')} /></Field>
              <Field label="Age group total"><input type="number" value={form.age_group_total} onChange={set('age_group_total')} /></Field>
            </div>
            <div className="grid-form-4" style={{ marginBottom: 16 }}>
              <Field label="Age group label">
                <input value={form.age_group_label} onChange={set('age_group_label')} placeholder="M40-44" />
              </Field>
              <Field label="Avg HR (bpm)"><input type="number" value={form.heart_rate_avg} onChange={set('heart_rate_avg')} /></Field>
              <Field label="Max HR (bpm)"><input type="number" value={form.heart_rate_max} onChange={set('heart_rate_max')} /></Field>
              <Field label="Elevation gain (m)"><input type="number" value={form.elevation_gain_m} onChange={set('elevation_gain_m')} /></Field>
            </div>
            <div className="grid-form-3" style={{ marginBottom: 16 }}>
              <Field label="Temp (°C)"><input type="number" value={form.weather_temp_c} onChange={set('weather_temp_c')} step="0.1" /></Field>
              <Field label="Weather">
                <select value={form.weather_condition} onChange={set('weather_condition')}>
                  <option value="">—</option>
                  {['Sunny','Partly cloudy','Overcast','Light rain','Heavy rain','Hot & humid','Cool','Cold','Windy'].map(w => <option key={w}>{w}</option>)}
                </select>
              </Field>
              <Field label="Official results URL">
                <input type="url" value={form.results_url} onChange={set('results_url')} placeholder="https://…" />
              </Field>
            </div>
            <div className="grid-form-2" style={{ marginBottom: 16 }}>
              <Field label="Certificate URL">
                <input type="url" value={form.certificate_url} onChange={set('certificate_url')} placeholder="https://…" />
              </Field>
            </div>
          </>)}

          {/* ── NOTES ───────────────────────────────────────────────── */}
          <div className="form-section-title">Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
            <Field label="Quick notes">
              <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Pre-race goals, logistics, reminders…" style={{ resize: 'vertical' }} />
            </Field>
            <Field label="Race report">
              <textarea value={form.race_report} onChange={set('race_report')} rows={6} placeholder="How did it go? How did you feel at each km? What would you do differently?" style={{ resize: 'vertical' }} />
            </Field>
          </div>

          {/* ── ACTIONS ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
            <Link to={isEdit ? `/races/${id}` : '/races'} className="btn btn-secondary">Cancel</Link>
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

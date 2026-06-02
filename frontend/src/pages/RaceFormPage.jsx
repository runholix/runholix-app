import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const EMPTY = {
  event_name: '', race_date: '', location: '', city: '', country: '', website_url: '',
  status: 'registered', registration_fee: '', registration_currency: 'USD',
  bib_number: '', confirmation_number: '',
  distance_km: '', distance_label: '', race_type: 'road', category: '',
  finish_time: '', gun_time: '',
  overall_place: '', overall_total: '', gender_place: '', gender_total: '',
  age_group_place: '', age_group_total: '', age_group_label: '',
  heart_rate_avg: '', heart_rate_max: '', elevation_gain_m: '',
  weather_temp_c: '', weather_condition: '',
  notes: '', race_report: '', results_url: '', certificate_url: '',
};

function Field({ label, children, className }) {
  return (
    <div className={`form-group${className ? ' ' + className : ''}`}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function RaceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.getRace(id).then(race => {
      setForm({
        event_name: race.event_name || '', race_date: race.race_date?.slice(0, 10) || '',
        location: race.location || '', city: race.city || '', country: race.country || '',
        website_url: race.website_url || '', status: race.status || 'registered',
        registration_fee: race.registration_fee || '', registration_currency: race.registration_currency || 'USD',
        bib_number: race.bib_number || '', confirmation_number: race.confirmation_number || '',
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
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

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

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="card">

          {/* Event info */}
          <div className="form-section-title" style={{ marginTop: 0 }}>Event info</div>
          <div className="grid-form-2" style={{ marginBottom: 16 }}>
            <Field label="Event name *" className="span-2">
              <input value={form.event_name} onChange={set('event_name')} placeholder="e.g. Jakarta Marathon 2024" required />
            </Field>
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

          {/* Registration */}
          <div className="form-section-title">Registration</div>
          <div className="grid-form-4" style={{ marginBottom: 16 }}>
            <Field label="Bib number">
              <input value={form.bib_number} onChange={set('bib_number')} placeholder="1234" />
            </Field>
            <Field label="Confirmation #">
              <input value={form.confirmation_number} onChange={set('confirmation_number')} />
            </Field>
            <Field label="Fee">
              <input type="number" value={form.registration_fee} onChange={set('registration_fee')} placeholder="350000" step="0.01" />
            </Field>
            <Field label="Currency">
              <select value={form.registration_currency} onChange={set('registration_currency')}>
                {['IDR','USD','EUR','GBP','SGD','MYR','JPY','AUD'].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Distance */}
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

          {/* Results — only if completed/dnf */}
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

          {/* Notes */}
          <div className="form-section-title">Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
            <Field label="Quick notes">
              <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Pre-race goals, logistics, reminders…" style={{ resize: 'vertical' }} />
            </Field>
            <Field label="Race report">
              <textarea value={form.race_report} onChange={set('race_report')} rows={6} placeholder="How did it go? How did you feel at each km? What would you do differently?" style={{ resize: 'vertical' }} />
            </Field>
          </div>

          {/* Actions */}
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

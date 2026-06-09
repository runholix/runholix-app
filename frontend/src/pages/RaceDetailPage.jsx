import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

function fmtTime(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

// Locale-formatted number with optional decimal places and suffix
function fmtNum(v, { decimals, suffix = '' } = {}) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (isNaN(n)) return null;
  const formatted = decimals !== undefined
    ? n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toLocaleString();
  return suffix ? `${formatted} ${suffix}` : formatted;
}

const STATUS_META = {
  completed: { label: 'Completed', cls: 'badge-completed' },
  registered: { label: 'Registered', cls: 'badge-registered' },
  upcoming: { label: 'Upcoming', cls: 'badge-upcoming' },
  dnf: { label: 'DNF', cls: 'badge-dnf' },
  dns: { label: 'DNS', cls: 'badge-dns' },
};

function PdfViewer({ userId, filePath, fileName, label = 'Attachment' }) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  if (!filePath || !fileName) return null;
  const url = api.attachmentUrl(userId, filePath.split('/').pop());
  // Download uses same URL but with Content-Disposition override via query param
  const downloadUrl = url + '&download=1';

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="form-section-title">{label}</div>

      {/* File row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: open ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
        borderBottom: open ? 'none' : undefined,
      }}>
        <i className="ti ti-file-type-pdf" style={{ color: 'var(--color-danger)', fontSize: 18, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </span>
        {/* Toggle inline view */}
        <button onClick={() => setOpen(v => !v)} className="btn btn-ghost btn-sm" title={open ? 'Hide' : 'View PDF'}>
          <i className={`ti ${open ? 'ti-eye-off' : 'ti-eye'}`} />
        </button>
        {/* Fullscreen */}
        <button onClick={() => setFullscreen(true)} className="btn btn-ghost btn-sm" title="Full screen">
          <i className="ti ti-arrows-maximize" />
        </button>
        {/* Download */}
        <a href={downloadUrl} download={fileName} className="btn btn-ghost btn-sm" title="Download">
          <i className="ti ti-download" />
        </a>
      </div>

      {/* Inline iframe */}
      {open && (
        <iframe
          src={url}
          title={fileName}
          style={{
            width: '100%', height: 600, display: 'block',
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius) var(--radius)',
          }}
        />
      )}

      {/* Fullscreen modal */}
      {fullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Modal toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px',
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
            <i className="ti ti-file-type-pdf" style={{ color: 'var(--color-danger)', fontSize: 18 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </span>
            <a href={downloadUrl} download={fileName} className="btn btn-secondary btn-sm" title="Download">
              <i className="ti ti-download" /> Download
            </a>
            <button onClick={() => setFullscreen(false)} className="btn btn-ghost btn-sm" title="Close">
              <i className="ti ti-x" style={{ fontSize: 16 }} />
            </button>
          </div>
          {/* Full-height iframe */}
          <iframe
            src={url}
            title={fileName}
            style={{ flex: 1, border: 'none', display: 'block', background: '#525659' }}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 500, fontFamily: mono ? 'monospace' : undefined, fontSize: 14 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  const anyChild = Array.isArray(children) ? children.some(Boolean) : !!children;
  if (!anyChild) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="form-section-title">{title}</div>
      <div className="detail-fields">{children}</div>
    </div>
  );
}

export default function RaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fromCalendar = location.state?.from === 'calendar';
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getRace(id).then(setRace).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${race.event_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await api.deleteRace(id);
    navigate('/races');
  };

  if (loading) return <div className="page" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>;
  if (!race) return <div className="page">Race not found.</div>;

  const sm = STATUS_META[race.status] || {};

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Link
        to={fromCalendar ? '/calendar' : '/races'}
        style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
      >
        <i className="ti ti-arrow-left" /> {fromCalendar ? 'Back to calendar' : 'Back to races'}
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 600 }}>{race.event_name}</h1>
              <span className={`badge ${sm.cls}`}>{sm.label}</span>
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {race.race_date && <span><i className="ti ti-calendar" style={{ verticalAlign: '-2px', marginRight: 4 }} />{format(parseISO(race.race_date), 'EEEE, d MMMM yyyy')}</span>}
              {(race.city || race.location) && <span><i className="ti ti-map-pin" style={{ verticalAlign: '-2px', marginRight: 4 }} />{race.city || race.location}{race.country ? `, ${race.country}` : ''}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <Link to={`/races/${id}/edit`} className="btn btn-secondary btn-sm">
              <i className="ti ti-edit" /> Edit
            </Link>
            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
              <i className="ti ti-trash" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Result highlight cards */}
      {race.status === 'completed' && race.finish_time_seconds && (
        <div className="result-cards">
          {[
            { label: 'Finish time', value: fmtTime(race.finish_time_seconds), icon: 'ti-clock', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
            { label: 'Overall place', value: race.overall_place ? `${Number(race.overall_place).toLocaleString()}${race.overall_total ? ` / ${Number(race.overall_total).toLocaleString()}` : ''}` : '—', icon: 'ti-users', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
            { label: 'Gender place', value: race.gender_place ? `${Number(race.gender_place).toLocaleString()}${race.gender_total ? ` / ${Number(race.gender_total).toLocaleString()}` : ''}` : '—', icon: 'ti-user', color: '#7c3aed', bg: '#faf5ff' },
            { label: 'Age group', value: race.age_group_place ? `${Number(race.age_group_place).toLocaleString()}${race.age_group_total ? ` / ${Number(race.age_group_total).toLocaleString()}` : ''} ${race.age_group_label || ''}`.trim() : '—', icon: 'ti-medal', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 14, flexShrink: 0 }}>
                  <i className={`ti ${s.icon}`} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <Section title="Event info">
          <Field label="Flag off time" value={race.flag_off_time} />
          <Field label="Cut off time" value={race.cutoff_time} />
          <Field label="Location" value={race.location} />
          <Field label="City" value={race.city} />
          <Field label="Country" value={race.country} />

        </Section>

        {/* Route file download */}
        {race.route_file_path && race.route_file_name && (
          <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Route file</div>
            <a
              href={api.routeFileUrl(user?.id, race.route_file_path.split('/').pop(), race.route_file_name)}
              download={race.route_file_name}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex' }}
            >
              <i className="ti ti-download" /> {race.route_file_name}
            </a>
          </div>
        )}

        <Section title="Registration details">
          <Field label="Bib number" value={race.bib_number} />
          <Field label="Name on BIB" value={race.bib_name} />
          <Field label="Confirmation #" value={race.confirmation_number} />
          <Field label="Registration fee" value={race.registration_fee ? `${Number(race.registration_fee).toLocaleString()} ${race.registration_currency || 'USD'}` : null} />
          <Field label="Jersey size" value={race.jersey_size} />
          <Field label="Registered email" value={race.registered_email} />
          <Field label="Registered phone" value={race.registered_phone} />
          <Field label="Finish time target" value={race.finish_time_target} mono />
          <Field label="Category" value={race.category} />
        </Section>

        {/* Trail: Qualification */}
        {race.race_type === 'trail' && race.qualification && (
          <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Qualification</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
              {race.qualification}
            </p>
          </div>
        )}

        <PdfViewer userId={user?.id} filePath={race.attachment_path} fileName={race.attachment_name} />

        <Section title="Race details">
          <Field label="Distance" value={race.distance_label || fmtNum(race.distance_km, { decimals: 2, suffix: 'km' })} />
          <Field label="Race type" value={race.race_type ? race.race_type.charAt(0).toUpperCase() + race.race_type.slice(1) : null} />
          {race.race_type === 'trail' && (
            <Field label="Elevation gain (required)" value={fmtNum(race.elevation_gain_req_m, { suffix: 'm' })} />
          )}
          {race.race_type === 'trail' && race.itra_point != null && race.itra_point !== '' && (
            <Field label="ITRA points" value={race.itra_point || null} />
          )}
        </Section>

        {/* ── FACILITY ──────────────────────────────────────────────── */}
        {Array.isArray(race.facilities) && race.facilities.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Facility</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {race.facilities.map(item => {
                const iconMap = {
                  'Finisher medal': 'ti-medal',
                  'BIB timing chip': 'ti-cpu',
                  'Race jersey': 'ti-shirt',
                  'Finisher certificate': 'ti-certificate',
                  'Finisher jersey': 'ti-shirt-filled',
                  'Finisher cap': 'ti-hat',
                };
                const icon = iconMap[item.name] || 'ti-check';
                return (
                  <div key={item.name} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 99,
                    background: 'var(--color-success-bg)',
                    border: '1px solid var(--color-success)',
                    color: 'var(--color-success)',
                    fontSize: 13, fontWeight: 500,
                  }}>
                    <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
                    {item.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RACE PACK COLLECTION ──────────────────────────────────── */}
        {(race.rpc_date_start || race.rpc_time || race.rpc_location || race.rpc_notes || race.rpc_attachment_path) && (
          <div style={{ marginBottom: 24 }}>
            <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Race Pack Collection</span>
              <span style={{
                padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: race.rpc_status === 'collected' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                color: race.rpc_status === 'collected' ? 'var(--color-success)' : 'var(--color-warning)',
                border: `1px solid ${race.rpc_status === 'collected' ? 'var(--color-success)' : 'var(--color-warning)'}`,
              }}>
                {race.rpc_status === 'collected' ? '✓ Collected' : 'Not collected'}
              </span>
            </div>

            <div className="detail-fields" style={{ marginBottom: 16 }}>
              {race.rpc_date_start && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>Collection dates</div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {format(parseISO(race.rpc_date_start), 'dd MMM yyyy')}
                    {race.rpc_date_end && race.rpc_date_end !== race.rpc_date_start
                      ? ` – ${format(parseISO(race.rpc_date_end), 'dd MMM yyyy')}`
                      : ''}
                  </div>
                </div>
              )}
              {race.rpc_time && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>Time</div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{race.rpc_time}</div>
                </div>
              )}
              {race.rpc_location && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>Location</div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{race.rpc_location}</div>
                </div>
              )}
            </div>

            {/* RPC PDF attachment */}
            {race.rpc_attachment_path && race.rpc_attachment_name && (
              <div style={{ marginBottom: 12 }}>
                <PdfViewer
                  userId={user?.id}
                  filePath={race.rpc_attachment_path}
                  fileName={race.rpc_attachment_name}
                  label="RPC Attachment"
                />
              </div>
            )}

            {race.rpc_notes && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 4 }}>Notes</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>{race.rpc_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── MANDATORY ITEMS (trail only) ───────────────────────────── */}
        {race.race_type === 'trail' && Array.isArray(race.mandatory_items) && race.mandatory_items.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Mandatory Items</div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      Gear name
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', width: 100 }}>
                      Mandatory
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', width: 110 }}>
                      Recommended
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {race.mandatory_items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < race.mandatory_items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {item.mandatory
                          ? <i className="ti ti-circle-check-filled" style={{ fontSize: 18, color: 'var(--color-danger)' }} />
                          : <i className="ti ti-circle-x" style={{ fontSize: 18, color: 'var(--color-border)' }} />}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {item.recommended
                          ? <i className="ti ti-circle-check-filled" style={{ fontSize: 18, color: 'var(--color-warning)' }} />
                          : <i className="ti ti-circle-x" style={{ fontSize: 18, color: 'var(--color-border)' }} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {race.status === 'completed' && (
          <Section title="Results">
            <Field label="Finish time (chip)" value={fmtTime(race.finish_time_seconds)} mono />
            <Field label="Gun time" value={fmtTime(race.gun_time_seconds)} mono />
            <Field label="Overall" value={race.overall_place ? `${Number(race.overall_place).toLocaleString()}${race.overall_total ? ` / ${Number(race.overall_total).toLocaleString()}` : ''}` : null} />
            <Field label="Gender" value={race.gender_place ? `${Number(race.gender_place).toLocaleString()}${race.gender_total ? ` / ${Number(race.gender_total).toLocaleString()}` : ''}` : null} />
            <Field label="Age group" value={race.age_group_place ? `${Number(race.age_group_place).toLocaleString()}${race.age_group_total ? ` / ${Number(race.age_group_total).toLocaleString()}` : ''} ${race.age_group_label || ''}`.trim() : null} />
          </Section>
        )}

        {/* Result file download (outside completed guard — may be uploaded anytime) */}
        {race.result_file_path && race.result_file_name && (
          <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Result file</div>
            <a
              href={api.resultFileUrl(user?.id, race.result_file_path.split('/').pop(), race.result_file_name)}
              download={race.result_file_name}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex' }}
            >
              <i className="ti ti-download" /> {race.result_file_name}
            </a>
          </div>
        )}

        {(race.heart_rate_avg || race.actual_distance_km || race.elevation_gain_m || race.weather_condition) && (
          <Section title="Conditions & vitals">
            <Field label="Avg heart rate" value={fmtNum(race.heart_rate_avg, { suffix: 'bpm' })} />
            <Field label="Max heart rate" value={fmtNum(race.heart_rate_max, { suffix: 'bpm' })} />
            <Field label="Actual distance" value={fmtNum(race.actual_distance_km, { decimals: 3, suffix: 'km' })} />
            <Field label="Elevation gain" value={fmtNum(race.elevation_gain_m, { suffix: 'm' })} />
            <Field label="Temperature" value={race.weather_temp_c != null ? `${Number(race.weather_temp_c).toLocaleString()}°C` : null} />
            <Field label="Weather" value={race.weather_condition} />
          </Section>
        )}

        {(race.website_url || race.instagram_url || race.results_url || race.certificate_url || race.strava_url || (race.race_type === 'trail' && race.itra_url)) && (
          <div style={{ marginBottom: 20 }}>
            <div className="form-section-title">Links</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {race.website_url && <a href={race.website_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-external-link" /> Race website</a>}
              {race.instagram_url && <a href={race.instagram_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-brand-instagram" /> Instagram</a>}
              {race.results_url && <a href={race.results_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-external-link" /> Official results</a>}
              {race.certificate_url && <a href={race.certificate_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-certificate" /> Certificate</a>}
              {race.strava_url && <a href={race.strava_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-brand-strava" /> Strava activity</a>}
              {race.race_type === 'trail' && race.itra_url && <a href={race.itra_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-external-link" /> ITRA race page</a>}
            </div>
          </div>
        )}

        {race.notes && (
          <div style={{ marginBottom: 20 }}>
            <div className="form-section-title">Notes</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{race.notes}</p>
          </div>
        )}

        {race.race_report && (
          <div>
            <div className="form-section-title">Race report</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{race.race_report}</p>
          </div>
        )}
      </div>
    </div>
  );
}

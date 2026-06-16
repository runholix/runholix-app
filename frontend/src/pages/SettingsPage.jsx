import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api.js';

// ── Generic section card ───────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Alert({ type, message }) {
  if (!message) return null;
  const styles = {
    success: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', icon: 'ti-circle-check' },
    error:   { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  icon: 'ti-circle-x'    },
    info:    { bg: 'var(--color-primary-bg)', color: 'var(--color-primary)', icon: 'ti-info-circle'  },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius)', background: s.bg, color: s.color, fontSize: 13, marginTop: 12 }}>
      <i className={`ti ${s.icon}`} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

// ── HEIC → JPEG conversion via canvas ────────────────────────────────────
async function heicToJpeg(file) {
  // Load heic2any lazily via dynamic import (CDN fallback: draw on canvas)
  // We use the createImageBitmap approach which works for HEIC in some browsers,
  // otherwise fall back to drawing via an img element with object URL.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error('HEIC conversion failed'));
        resolve(new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load HEIC image')); };
    img.src = url;
  });
}

const AVATAR_MAX_MB = 10;
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;
const AVATAR_ACCEPT = '.jpg,.jpeg,.png,.heic,.HEIC';

// ── Avatar Section ─────────────────────────────────────────────────────────
function AvatarSection({ user, onUpdate }) {
  const inputRef = useRef();
  const [preview, setPreview]   = useState(null); // local blob preview
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving]   = useState(false);
  const [result, setResult]       = useState(null);

  const currentAvatarUrl = user?.avatar_path
    ? api.avatarUrl(user.id) + '?v=' + Date.now() // bust cache after update
    : null;

  const displayUrl = preview || (user?.avatar_path ? api.avatarUrl(user.id) : null);

  const handleFile = async (e) => {
    let file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setResult(null);

    // HEIC conversion
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'heic') {
      try {
        file = await heicToJpeg(file);
      } catch {
        return setResult({ type: 'error', message: 'Could not convert HEIC image. Please export as JPG/PNG from your device.' });
      }
    }

    // Validate type
    const allowedExt = ['jpg', 'jpeg', 'png'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!allowedExt.includes(fileExt)) {
      return setResult({ type: 'error', message: 'Only JPG, JPEG, PNG and HEIC files are accepted.' });
    }

    // Validate size
    if (file.size > AVATAR_MAX_BYTES) {
      return setResult({ type: 'error', message: `Image too large. Maximum size is ${AVATAR_MAX_MB} MB.` });
    }

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Upload
    setUploading(true);
    try {
      const res = await api.uploadAvatar(file);
      onUpdate({ avatar_path: res.avatar_path });
      setResult({ type: 'success', message: 'Avatar updated successfully.' });
    } catch (err) {
      setPreview(null);
      setResult({ type: 'error', message: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove your avatar photo?')) return;
    setRemoving(true); setResult(null);
    try {
      await api.deleteAvatar();
      setPreview(null);
      onUpdate({ avatar_path: null });
      setResult({ type: 'success', message: 'Avatar removed.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally { setRemoving(false); }
  };

  const initials = (user?.name || '?').charAt(0).toUpperCase();

  return (
    <Section title="Profile photo" description="JPG, PNG or HEIC · Max 10 MB · Cropped to square, 512 × 512 px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Avatar preview */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Avatar"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)', fontWeight: 700, fontSize: 28,
              border: '2px solid var(--color-border)',
            }}>{initials}</div>
          )}
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="ti ti-loader" style={{ color: '#fff', fontSize: 24 }} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input ref={inputRef} type="file" accept={AVATAR_ACCEPT} style={{ display: 'none' }} onChange={handleFile} />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => inputRef.current.click()}
            disabled={uploading || removing}
          >
            <i className="ti ti-upload" /> {uploading ? 'Uploading…' : user?.avatar_path ? 'Change photo' : 'Upload photo'}
          </button>
          {(user?.avatar_path || preview) && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleRemove}
              disabled={uploading || removing}
            >
              <i className="ti ti-trash" /> {removing ? 'Removing…' : 'Remove photo'}
            </button>
          )}
        </div>
      </div>
      <Alert {...(result || {})} />
    </Section>
  );
}

// ── Update Name ───────────────────────────────────────────────────────────
function NameSection({ user, onUpdate }) {
  const [name, setName]     = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async e => {
    e.preventDefault();
    setSaving(true); setResult(null);
    try {
      const updated = await api.updateName({ name });
      onUpdate(updated);
      setResult({ type: 'success', message: 'Name updated successfully.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  return (
    <Section title="Display name" description="Your name shown across the app.">
      <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 220px' }}>
          <label className="form-label">Full name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !name.trim() || name.trim() === user?.name}>
          {saving ? 'Saving…' : 'Update name'}
        </button>
      </form>
      <Alert {...(result || {})} />
    </Section>
  );
}

// ── Change Email ──────────────────────────────────────────────────────────
function EmailSection({ user }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving]     = useState(false);
  const [result, setResult]     = useState(null);
  const [sent, setSent]         = useState(false);

  const submit = async e => {
    e.preventDefault();
    setSaving(true); setResult(null);
    try {
      const res = await api.requestEmailChange({ new_email: newEmail, password });
      setSent(true);
      setResult({ type: 'success', message: res.message });
      setNewEmail(''); setPassword('');
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  return (
    <Section title="Email address" description={<>Current email: <strong>{user?.email}</strong></>}>
      {sent ? (
        <Alert type="info" message="Check your new email inbox for a confirmation link. Your email will only change once you click it." />
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-form-2">
            <div className="form-group">
              <label className="form-label">New email address *</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Current password (to confirm) *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Sending…' : 'Send confirmation email'}
            </button>
          </div>
          <Alert {...(result || {})} />
        </form>
      )}
    </Section>
  );
}

// ── Change Password ───────────────────────────────────────────────────────
function PasswordSection() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (form.next !== form.confirm)
      return setResult({ type: 'error', message: 'New passwords do not match.' });
    if (form.next.length < 8)
      return setResult({ type: 'error', message: 'Password must be at least 8 characters.' });
    setSaving(true); setResult(null);
    try {
      await api.changePassword({ current_password: form.current, new_password: form.next });
      setForm({ current: '', next: '', confirm: '' });
      setResult({ type: 'success', message: 'Password updated. A confirmation email has been sent.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  const strength = (() => {
    const p = form.next;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak',   color: 'var(--color-danger)',  pct: 25 };
    if (score <= 2) return { label: 'Fair',   color: 'var(--color-warning)', pct: 50 };
    if (score <= 3) return { label: 'Good',   color: '#0ea5e9',              pct: 75 };
    return               { label: 'Strong', color: 'var(--color-success)', pct: 100 };
  })();

  return (
    <Section title="Password" description="Use a strong, unique password. You'll receive an email notification when it changes.">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Current password *</label>
          <input type="password" value={form.current} onChange={set('current')} placeholder="••••••••" required />
        </div>
        <div className="grid-form-2">
          <div className="form-group">
            <label className="form-label">New password *</label>
            <input type="password" value={form.next} onChange={set('next')} placeholder="Min 8 characters" required minLength={8} />
            {strength && (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, transition: 'width 0.3s, background 0.3s' }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 3, fontWeight: 500 }}>{strength.label}</div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Confirm new password *</label>
            <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat new password" required />
            {form.confirm && form.next !== form.confirm && (
              <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>Passwords do not match</div>
            )}
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !form.current || !form.next || !form.confirm}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
        <Alert {...(result || {})} />
      </form>
    </Section>
  );
}

// ── Calendar feed section ─────────────────────────────────────────────────
function CalendarFeedSection() {
  const [enabled, setEnabled] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getIcal().then(data => {
      setEnabled(data.ical_enabled);
      // feed_url may be relative (e.g. /ical/token.ics) if APP_URL not set
      const url = data.feed_url
        ? data.feed_url.startsWith('http')
          ? data.feed_url
          : `${window.location.origin}${data.feed_url}`
        : '';
      setFeedUrl(url);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    setSaving(true); setResult(null);
    try {
      const data = await api.toggleIcal({ action: enabled ? 'disable' : 'enable' });
      setEnabled(data.ical_enabled);
      const url = data.feed_url
        ? data.feed_url.startsWith('http')
          ? data.feed_url
          : `${window.location.origin}${data.feed_url}`
        : '';
      setFeedUrl(url);
      setResult({ type: 'success', message: data.ical_enabled ? 'Calendar feed enabled.' : 'Calendar feed disabled.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  const regenerate = async () => {
    if (!window.confirm('Regenerate the calendar URL? Your current subscription link will stop working and you will need to re-add the new URL to your calendar app.')) return;
    setSaving(true); setResult(null);
    try {
      const data = await api.toggleIcal({ action: 'regenerate' });
      setEnabled(true);
      const url = data.feed_url
        ? data.feed_url.startsWith('http')
          ? data.feed_url
          : `${window.location.origin}${data.feed_url}`
        : '';
      setFeedUrl(url);
      setResult({ type: 'success', message: 'New calendar URL generated.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return null;

  return (
    <Section
      title="Calendar feed"
      description="Subscribe to your races, RPC dates and training plans in any calendar app (Apple Calendar, Google Calendar, Outlook, etc.)"
    >
      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>iCal / WebCal subscription</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {enabled ? 'Your calendar feed is active.' : 'Enable to get a subscription URL.'}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`btn btn-sm ${enabled ? 'btn-secondary' : 'btn-primary'}`}
        >
          <i className={`ti ${enabled ? 'ti-player-stop' : 'ti-player-play'}`} />
          {saving ? 'Saving…' : enabled ? 'Disable feed' : 'Enable feed'}
        </button>
      </div>

      {/* Feed URL */}
      {enabled && feedUrl && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            Subscription URL
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 10px',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
          }}>
            <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', color: 'var(--color-text-muted)', overflow: 'hidden' }}>
              {feedUrl}
            </code>
            <button onClick={copy} className="btn btn-ghost btn-sm" title="Copy URL" style={{ flexShrink: 0 }}>
              <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ color: copied ? 'var(--color-success)' : undefined }} />
            </button>
          </div>

          {/* Quick-add links */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <a
              href={`webcal://${feedUrl.replace(/^https?:\/\//, '')}`}
              className="btn btn-secondary btn-sm"
              title="Subscribe in Apple Calendar or compatible apps"
            >
              <i className="ti ti-calendar-plus" /> Subscribe (webcal)
            </a>
            <a
              href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl.replace(/^https?/, 'webcal'))}`}
              target="_blank" rel="noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <i className="ti ti-brand-google" /> Add to Google
            </a>
          </div>

          {/* Regenerate */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              If you suspect your URL has been shared, regenerate a new one. Your existing subscriptions will need to be updated.
            </div>
            <button onClick={regenerate} className="btn btn-secondary btn-sm" disabled={saving}>
              <i className="ti ti-refresh" /> Regenerate URL
            </button>
          </div>
        </div>
      )}

      <Alert {...(result || {})} />
    </Section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState(user);

  const handleUpdate = (patch) => {
    setCurrentUser(u => ({ ...u, ...patch }));
  };

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Account settings</h1>
        <p className="page-subtitle">Manage your profile and security settings.</p>
      </div>

      <AvatarSection   user={currentUser} onUpdate={handleUpdate} />
      <NameSection     user={currentUser} onUpdate={u => handleUpdate({ name: u.name })} />
      <EmailSection    user={currentUser} />
      <PasswordSection />
      <CalendarFeedSection />
    </div>
  );
}

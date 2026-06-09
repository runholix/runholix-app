import { useState } from 'react';
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

// ── Main page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [currentUser, setCurrentUser] = useState(user);

  const handleNameUpdate = updated => {
    setCurrentUser(u => ({ ...u, name: updated.name }));
    // Also refresh the auth context user so sidebar name updates
    localStorage.setItem('rt_user_name', updated.name);
  };

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Account settings</h1>
        <p className="page-subtitle">Manage your profile and security settings.</p>
      </div>

      <NameSection user={currentUser} onUpdate={handleNameUpdate} />
      <EmailSection user={currentUser} />
      <PasswordSection />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { Section } from './SettingsPage.jsx';
import Alert from '../../components/Alert.jsx';

const STORAGE_PREFIX = 'rt_email_change_';

function readState(email) {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + email.toLowerCase().trim());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(email, value) {
  if (!email) return;
  localStorage.setItem(STORAGE_PREFIX + email.toLowerCase().trim(), JSON.stringify(value));
}

export default function EmailSection({ user }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [sent, setSent] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remainingResends, setRemainingResends] = useState(3);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = readState(user?.email);
    if (saved) {
      setCooldownUntil(saved.cooldownUntil || 0);
      setRemainingResends(saved.remainingResends ?? 3);
    }
  }, [user?.email]);

  const cooldownSeconds = useMemo(() => Math.max(0, Math.ceil((cooldownUntil - now) / 1000)), [cooldownUntil, now]);
  const blocked = cooldownSeconds > 0 || remainingResends <= 0;
  const buttonLabel = cooldownSeconds > 0
    ? `Send available in ${cooldownSeconds}s`
    : remainingResends <= 0
      ? 'Limit reached'
      : 'Send confirmation email';

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await api.requestEmailChange({ new_email: newEmail, password });
      const nextCooldownUntil = Date.now() + ((res.cooldownSeconds || 60) * 1000);
      const nextRemaining = typeof res.remainingResends === 'number' ? res.remainingResends : Math.max(0, remainingResends - 1);
      setCooldownUntil(nextCooldownUntil);
      setRemainingResends(nextRemaining);
      writeState(user?.email, {
        cooldownUntil: nextCooldownUntil,
        remainingResends: nextRemaining,
      });
      setSent(true);
      setResult({ type: 'success', message: res.message });
      setNewEmail('');
      setPassword('');
    } catch (err) {
      const cooldown = err.data?.cooldownSeconds || 0;
      const remaining = typeof err.data?.remainingResends === 'number' ? err.data.remainingResends : remainingResends;
      if (cooldown) {
        const nextCooldownUntil = Date.now() + cooldown * 1000;
        setCooldownUntil(nextCooldownUntil);
        setRemainingResends(remaining);
        writeState(user?.email, { cooldownUntil: nextCooldownUntil, remainingResends: remaining });
      } else {
        setRemainingResends(remaining);
      }
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
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
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || blocked}>
              {saving ? 'Sending…' : buttonLabel}
            </button>
          </div>
          <Alert {...(result || {})} />
        </form>
      )}
    </Section>
  );
}

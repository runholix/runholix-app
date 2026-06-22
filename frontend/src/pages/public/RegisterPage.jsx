import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import ThemeToggle from '../../components/ThemeToggle.jsx';

const STORAGE_PREFIX = 'rt_activation_resend_';

function readResendState(email) {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + email.toLowerCase().trim());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeResendState(email, value) {
  if (!email) return;
  localStorage.setItem(STORAGE_PREFIX + email.toLowerCase().trim(), JSON.stringify(value));
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // When email is enabled, backend returns requiresActivation instead of a token
  const [pendingEmail, setPendingEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendError, setResendError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remainingResends, setRemainingResends] = useState(3);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = readResendState(pendingEmail);
    if (saved) {
      setCooldownUntil(saved.cooldownUntil || 0);
      setRemainingResends(saved.remainingResends ?? 3);
    }
  }, [pendingEmail]);

  const cooldownSeconds = useMemo(() => Math.max(0, Math.ceil((cooldownUntil - now) / 1000)), [cooldownUntil, now]);
  const resendBlocked = cooldownSeconds > 0 || remainingResends <= 0;
  const resendButtonLabel = cooldownSeconds > 0
    ? `Resend available in ${cooldownSeconds}s`
    : remainingResends <= 0
      ? 'Resend limit reached'
      : 'Resend activation email';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.register({ name: form.name, email: form.email, password: form.password });
      if (data.requiresActivation) {
        // Email activation flow
        setPendingEmail(form.email);
        const nextCooldownUntil = Date.now() + ((data.cooldownSeconds || 60) * 1000);
        const nextRemaining = typeof data.remainingResends === 'number' ? data.remainingResends : 3;
        setCooldownUntil(nextCooldownUntil);
        setRemainingResends(nextRemaining);
        writeResendState(form.email, {
          cooldownUntil: nextCooldownUntil,
          remainingResends: nextRemaining,
        });
      } else {
        // Email disabled — direct login
        localStorage.setItem('rt_token', data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true); setResendMsg(''); setResendError('');
    try {
      const res = await api.resendActivation({ email: pendingEmail });
      const nextCooldownUntil = Date.now() + ((res.cooldownSeconds || 60) * 1000);
      const nextRemaining = typeof res.remainingResends === 'number' ? res.remainingResends : Math.max(0, remainingResends - 1);
      setCooldownUntil(nextCooldownUntil);
      setRemainingResends(nextRemaining);
      writeResendState(pendingEmail, {
        cooldownUntil: nextCooldownUntil,
        remainingResends: nextRemaining,
      });
      setResendMsg('A new activation link has been sent to your email.');
    } catch (err) {
      const cooldown = err.data?.cooldownSeconds || 0;
      const remaining = typeof err.data?.remainingResends === 'number' ? err.data.remainingResends : remainingResends;
      if (cooldown) {
        const nextCooldownUntil = Date.now() + cooldown * 1000;
        setCooldownUntil(nextCooldownUntil);
        setRemainingResends(remaining);
        writeResendState(pendingEmail, { cooldownUntil: nextCooldownUntil, remainingResends: remaining });
      } else {
        setRemainingResends(remaining);
        writeResendState(pendingEmail, { cooldownUntil, remainingResends: remaining });
      }
      setResendError(err.message || 'Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // ── Pending activation state ──────────────────────────────────────────
  if (pendingEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></div>
        <div className="card" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <i className="ti ti-mail" style={{ fontSize: 44, color: 'var(--color-primary)', display: 'block', marginBottom: 16 }} />
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 10 }}>Check your email</div>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            We sent an activation link to <strong>{pendingEmail}</strong>.<br />
            Click the link in the email to activate your account.
          </p>
          {resendMsg && (
            <div style={{ fontSize: 13, color: 'var(--color-success)', marginBottom: 14, padding: '8px 12px', background: 'var(--color-success-bg)', borderRadius: 8 }}>
              {resendMsg}
            </div>
          )}
          {resendError && (
            <div className="alert-error" style={{ marginBottom: 14, textAlign: 'left' }}>
              {resendError}
            </div>
          )}
          <button onClick={resend} disabled={resending || resendBlocked} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
            {resending ? 'Sending…' : resendButtonLabel}
          </button>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Back to login</Link>
        </div>
      </div>
    );
  }

  // ── Register form ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></div>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Create account</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Start tracking your running races</div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input placeholder="Your name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" placeholder="Min 8 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={8} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

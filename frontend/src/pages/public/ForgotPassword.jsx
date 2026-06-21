import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import ThemeToggle from '../../components/ThemeToggle.jsx';

const STORAGE_PREFIX = 'rt_forgot_password_';

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

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const isResetMode = !!token;
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remainingResends, setRemainingResends] = useState(3);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = readState(email);
    if (saved) {
      setCooldownUntil(saved.cooldownUntil || 0);
      setRemainingResends(saved.remainingResends ?? 3);
    }
  }, [email]);

  const cooldownSeconds = useMemo(() => Math.max(0, Math.ceil((cooldownUntil - now) / 1000)), [cooldownUntil, now]);
  const resendBlocked = cooldownSeconds > 0 || remainingResends <= 0;
  const sendButtonLabel = cooldownSeconds > 0
    ? `Resend available in ${cooldownSeconds}s`
    : remainingResends <= 0
      ? 'Reset limit reached'
      : 'Send reset email';

  const requestReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.requestPasswordReset({ email });
      const nextCooldownUntil = Date.now() + ((res.cooldownSeconds || 60) * 1000);
      setCooldownUntil(nextCooldownUntil);
      setRemainingResends(typeof res.remainingResends === 'number' ? res.remainingResends : Math.max(0, remainingResends - 1));
      writeState(email, {
        cooldownUntil: nextCooldownUntil,
        remainingResends: typeof res.remainingResends === 'number' ? res.remainingResends : Math.max(0, remainingResends - 1),
      });
      setMessage(res.message || 'If that email exists, a reset link has been sent.');
    } catch (err) {
      const cooldown = err.data?.cooldownSeconds || 0;
      const remaining = typeof err.data?.remainingResends === 'number' ? err.data.remainingResends : remainingResends;
      if (cooldown) {
        const nextCooldownUntil = Date.now() + cooldown * 1000;
        setCooldownUntil(nextCooldownUntil);
        setRemainingResends(remaining);
        writeState(email, { cooldownUntil: nextCooldownUntil, remainingResends: remaining });
      }
      setError(err.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await api.confirmPasswordReset({ token, new_password: newPassword });
      setMessage('Password reset complete. You can sign in now.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></div>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{isResetMode ? 'Set a new password' : 'Forgot password'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {isResetMode ? 'Enter a new password for your account.' : `We’ll send a password reset link to your email address.`}
          </div>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: 14 }}>{error}</div>}
        {message && <div className="alert-success" style={{ marginBottom: 14 }}>{message}</div>}

        {!isResetMode ? (
          <form onSubmit={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || resendBlocked} style={{ justifyContent: 'center' }}>
              {loading ? 'Sending…' : sendButtonLabel}
            </button>
          </form>
        ) : (
          <form onSubmit={submitNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">New password *</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password *</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Updating…' : 'Reset password'}
            </button>
          </form>
        )}

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

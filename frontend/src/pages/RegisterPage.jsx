import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // When email is enabled, backend returns requiresActivation instead of a token
  const [pendingEmail, setPendingEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.register({ name: form.name, email: form.email, password: form.password });
      if (data.requiresActivation) {
        // Email activation flow
        setPendingEmail(form.email);
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
    setResending(true); setResendMsg('');
    try {
      await api.resendActivation({ email: pendingEmail });
      setResendMsg('A new activation link has been sent to your email.');
    } catch {
      setResendMsg('Could not resend. Please try again.');
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
          <button onClick={resend} disabled={resending} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
            {resending ? 'Sending…' : 'Resend activation email'}
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

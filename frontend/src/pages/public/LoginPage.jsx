import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import APP_NAME from '../../lib/appName.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Read the intended destination from ?redirect=
  const params = new URLSearchParams(location.search);
  const redirectTo = params.get('redirect');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      // Navigate to intended URL, or dashboard if none
      navigate(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>
            <i className="ti ti-run" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{APP_NAME}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sign in to your account</div>
          </div>
        </div>

        {redirectTo && (
          <div style={{
            background: 'var(--color-info-bg)', color: 'var(--color-info)',
            border: '1px solid var(--color-info)', borderRadius: 'var(--radius)',
            padding: '9px 12px', fontSize: 13, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className="ti ti-lock" style={{ flexShrink: 0 }} />
            Sign in to continue to the page you came from.
          </div>
        )}

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
          No account? <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Register</Link>
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function ActivatePage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const { login: authLogin } = useAuth();
  const token = params.get('token');

  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No activation token found in the link.'); return; }

    api.activate({ token })
      .then(data => {
        // Store JWT and mark user as logged in
        localStorage.setItem('rt_token', data.token);
        setStatus('success');
        // Redirect to dashboard after 2 s
        setTimeout(() => navigate('/'), 2000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message || 'Activation failed.');
      });
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div className="card" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <i className="ti ti-loader" style={{ fontSize: 36, color: 'var(--color-primary)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Activating your account…</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Please wait a moment.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <i className="ti ti-circle-check-filled" style={{ fontSize: 44, color: 'var(--color-success)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Account activated! 🎉</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>
              Your account is now active. Redirecting you to the dashboard…
            </div>
            <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
              Go to dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <i className="ti ti-circle-x" style={{ fontSize: 44, color: 'var(--color-danger)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Activation failed</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>{message}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/register" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                Register again
              </Link>
              <Link to="/login" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

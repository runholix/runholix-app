import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function ActivatePage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const token = params.get('token');

  // status: loading | success | pending_approval | error
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No activation token found in the link.');
      return;
    }

    api.activate({ token })
      .then(data => {
        if (data.requiresApproval) {
          // Admin approval mode — email confirmed, now waiting for admin
          setStatus('pending_approval');
          setMessage(data.message || 'Your account is awaiting admin approval.');
        } else {
          // Standard mode — account active, JWT returned
          localStorage.setItem('rt_token', data.token);
          setStatus('success');
          setTimeout(() => navigate('/'), 2000);
        }
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
      <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>

        {/* Loading */}
        {status === 'loading' && (
          <>
            <i className="ti ti-loader" style={{ fontSize: 36, color: 'var(--color-primary)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Activating your account…</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Please wait a moment.</div>
          </>
        )}

        {/* Success — no admin required */}
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

        {/* Pending admin approval */}
        {status === 'pending_approval' && (
          <>
            <i className="ti ti-clock" style={{ fontSize: 44, color: 'var(--color-warning)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Email confirmed ✓</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              {message}
            </div>
            <div style={{
              background: 'var(--color-warning-bg)',
              border: '1px solid var(--color-warning)',
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              fontSize: 13,
              color: 'var(--color-warning)',
              textAlign: 'left',
              marginBottom: 20,
            }}>
              <i className="ti ti-info-circle" style={{ verticalAlign: '-2px', marginRight: 6 }} />
              You'll receive an email notification once an administrator reviews your account.
            </div>
            <Link to="/login" className="btn btn-secondary" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
              Back to login
            </Link>
          </>
        )}

        {/* Error */}
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

import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function ConfirmEmailPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token');
  const [status, setStatus]   = useState('loading');
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No confirmation token found in the link.'); return; }

    api.confirmEmail({ token })
      .then(data => {
        // Cookie session is already refreshed by the backend
        setNewEmail(data.user.email);
        setStatus('success');
        setTimeout(() => navigate('/settings'), 2500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message || 'Confirmation failed.');
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
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Confirming email change…</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Please wait a moment.</div>
          </>
        )}
        {status === 'success' && (
          <>
            <i className="ti ti-circle-check-filled" style={{ fontSize: 44, color: 'var(--color-success)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Email updated! ✉️</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>
              Your email address has been changed to <strong>{newEmail}</strong>.<br />
              Redirecting to settings…
            </div>
            <Link to="/settings" className="btn btn-primary" style={{ display: 'inline-flex' }}>
              Go to settings
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <i className="ti ti-circle-x" style={{ fontSize: 44, color: 'var(--color-danger)', display: 'block', marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Confirmation failed</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>{message}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/settings" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                Back to settings
              </Link>
              <Link to="/login" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

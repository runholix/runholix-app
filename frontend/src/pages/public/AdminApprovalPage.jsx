import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import NotFoundPage from './NotFoundPage.jsx';

export default function AdminApprovalPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState(null);

  const canSubmit = useMemo(() => !!token && status !== 'submitting', [token, status]);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      return;
    }
    let alive = true;
    setStatus('loading');
    api.adminApprovalDetails(token)
      .then((data) => {
        if (!alive) return;
        setUser(data.user || null);
        setStatus('idle');
      })
      .catch((err) => {
        if (!alive) return;
        if (err.status === 400 || err.status === 403 || err.status === 404) {
          setNotFound(true);
          return;
        }
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(action) {
    if (!token) return;
    setStatus('submitting');
    try {
      const data = await api.adminApproval({ token, action, message });
      setResult(data);
      setStatus(action);
      return data;
    } catch (err) {
      if (err.status === 400 || err.status === 403) {
        setNotFound(true);
        return;
      }
      setStatus('error');
    }
  }

  if (notFound) return <NotFoundPage />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Admin approval review</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.6 }}>
            Add an optional message, then approve or reject this account request.
          </div>
        </div>

        {user && (
          <div style={{ marginBottom: 16, padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>User</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{user.email}</div>
          </div>
        )}

        {status === 'loading' && (
          <div style={{ marginBottom: 16, color: 'var(--color-text-muted)', fontSize: 13 }}>
            Loading approval details…
          </div>
        )}

        {result ? (
          <div style={{ marginBottom: 16, padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Backend response</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{result.message || 'Done.'}</div>
            {result.user && (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {result.user.name} {result.user.email ? `(${result.user.email})` : ''}
              </div>
            )}
            {typeof result.notified === 'boolean' && (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Notification sent: {result.notified ? 'yes' : 'no'}
              </div>
            )}
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              placeholder="Optional note to the user"
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                padding: '12px 14px',
                fontSize: 14,
                marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!canSubmit}
                onClick={() => submit('reject')}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSubmit}
                onClick={() => submit('approve')}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Approve
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {token ? 'This review link can only be used once.' : 'The approval link is missing a token.'}
        </div>

        <div style={{ marginTop: 18 }}>
          <a href="/" className="btn btn-secondary" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
            Go to home
          </a>
        </div>
      </div>
    </div>
  );
}

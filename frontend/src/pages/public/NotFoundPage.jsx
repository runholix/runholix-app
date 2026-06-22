import { Link } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div className="card" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, marginBottom: 12 }}>404</div>
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Page not found</div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          The route you requested does not exist.
        </div>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
          Go to home
        </Link>
      </div>
    </div>
  );
}

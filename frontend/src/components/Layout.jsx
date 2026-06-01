import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const nav = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Dashboard', exact: true },
  { to: '/races', icon: 'ti-trophy', label: 'My Races' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 0', position: 'sticky', top: 0, height: '100vh'
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16
            }}>
              <i className="ti ti-run" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Race Tracker</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {nav.map(({ to, icon, label, exact }) => (
            <NavLink
              key={to} to={to} end={exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                marginBottom: 2, transition: 'all 0.1s'
              })}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--color-primary-bg)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)', fontWeight: 600, fontSize: 12
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-hint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
            <i className="ti ti-logout" />
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

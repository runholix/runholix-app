import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const nav = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Dashboard', exact: true },
  { to: '/races', icon: 'ti-trophy', label: 'My Races' },
];

function SidebarContent({ user, onLogout, onClose }) {
  return (
    <>
      {/* Logo / close button */}
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 16, flexShrink: 0,
            }}>
              <i className="ti ti-run" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Race Tracker</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: 4 }} aria-label="Close menu">
              <i className="ti ti-x" style={{ fontSize: 18 }} />
            </button>
          )}
        </div>
      </div>

      {/* Nav — scrollable if many items */}
      <div className="sidebar-nav">
        {nav.map(({ to, icon, label, exact }) => (
          <NavLink
            key={to} to={to} end={exact}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: isActive ? 'var(--color-primary-bg)' : 'transparent',
              fontWeight: isActive ? 500 : 400,
              marginBottom: 2, transition: 'all 0.1s', fontSize: 14,
            })}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Bottom panel — always visible, never clipped */}
      <div className="sidebar-bottom">
        {/* Theme switcher */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>
            Appearance
          </div>
          <ThemeToggle />
        </div>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, flexShrink: 0,
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-hint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
          </div>
        </div>

        <button onClick={onLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
          <i className="ti ti-logout" /> Sign out
        </button>
      </div>
    </>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer overlay */}
      <div className={`drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />

      {/* Mobile drawer — same structure as sidebar */}
      <div className={`drawer-sidebar${drawerOpen ? ' open' : ''}`}>
        <SidebarContent user={user} onLogout={handleLogout} onClose={() => setDrawerOpen(false)} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile / tablet topbar */}
        <header className="topbar">
          <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <i className="ti ti-menu-2" style={{ fontSize: 20 }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14,
            }}>
              <i className="ti ti-run" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Race Tracker</span>
          </div>
          {/* Compact theme toggle in topbar */}
          <ThemeToggle compact />
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, flexShrink: 0,
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

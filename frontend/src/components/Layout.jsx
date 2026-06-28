import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { APP_VERSION } from '../lib/version.js';
import ThemeToggle from './ThemeToggle.jsx';
import { api } from '../lib/api.js';

// Shared avatar — photo if available, else initial letter
function Avatar({ user, avatarTs, size = 30, fontSize = 13 }) {
  const hasAvatar = user?.avatar_path && user?.id;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--color-primary)', fontWeight: 600, fontSize, overflow: 'hidden',
    }}>
      {hasAvatar ? (
        <img
          src={`${api.avatarUrl(user.id)}?v=${avatarTs}`}
          alt={user.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        user?.name?.charAt(0).toUpperCase()
      )}
    </div>
  );
}

const nav = [
  { to: '/', icon: 'ti-layout-dashboard', label: 'Dashboard', exact: true },
  { to: '/races', icon: 'ti-trophy', label: 'My Races' },
  { to: '/calendar', icon: 'ti-calendar', label: 'Calendar' },
  { to: '/settings', icon: 'ti-settings', label: 'Settings' },
];

function SidebarContent({ user, onLogout, onClose, avatarTs }) {
  return (
    <>
      {/* Logo row */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 20, flexShrink: 0,
            }}>
              <i className="ti ti-run" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Runholix Demo</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: 4 }} aria-label="Close menu">
              <i className="ti ti-x" style={{ fontSize: 18 }} />
            </button>
          )}
        </div>
      </div>

      {/* Nav links — scrolls if needed */}
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

      {/* Bottom panel — flex-shrink:0 keeps it anchored, never clipped */}
      <div className="sidebar-bottom">
        {/* Theme label + toggle */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
          }}>
            Appearance
          </div>
          {/* Always compact=true in sidebar — fills width, icon-only prevents overflow */}
          <ThemeToggle compact={false} />
        </div>

        {/* User row */}
        <Link to="/settings" onClick={onClose} style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          color: 'inherit', borderRadius: 'var(--radius)', padding: '4px 2px',
          transition: 'background 0.1s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
          onMouseLeave={e => e.currentTarget.style.background = ''}
        >
          <Avatar user={user} avatarTs={avatarTs} size={30} fontSize={12} />
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-hint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
          </div>
          <i className="ti ti-settings" style={{ fontSize: 13, color: 'var(--color-text-hint)', flexShrink: 0 }} />
        </Link>

        <button onClick={onLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
          <i className="ti ti-logout" style={{ fontSize: 14 }} /> Sign out
        </button>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-hint)', textAlign: 'center' }}>
          v{APP_VERSION}
        </div>
      </div>
    </>
  );
}

export default function Layout() {
  const { user, logout, avatarTs } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    if (!window.confirm(`Sign out of Runholix Demo?`)) return;
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <SidebarContent user={user} onLogout={handleLogout} avatarTs={avatarTs} />
      </aside>

      {/* Mobile drawer overlay */}
      <div className={`drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />

      {/* Mobile drawer */}
      <div className={`drawer-sidebar${drawerOpen ? ' open' : ''}`}>
        <SidebarContent user={user} onLogout={handleLogout} onClose={() => setDrawerOpen(false)} avatarTs={avatarTs} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile/tablet topbar */}
        <header className="topbar">
          <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <i className="ti ti-menu-2" style={{ fontSize: 20 }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 17,
            }}>
              <i className="ti ti-run" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Runholix Demo</span>
          </div>
          {/* Compact icon-only toggle in topbar */}
          <ThemeToggle compact={true} />
          <Avatar user={user} avatarTs={avatarTs} size={30} fontSize={13} />
        </header>

        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import AvatarSection from "./AvatarSection.jsx";
import NameSection from "./NameSection.jsx";
import EmailSection from "./EmailSection.jsx";
import PasswordSection from "./PasswordSection.jsx";
import PasskeySection from "./PasskeySection.jsx";
import CalendarFeedSection from "./CalendarFeedSection.jsx";
import TimezoneSection from "./TimezoneSection.jsx";

// ── Generic section card ───────────────────────────────────────────────────
export function Section({ title, description, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [currentUser, setCurrentUser] = useState(user);

  const handleUpdate = (patch) => {
    setCurrentUser(u => ({ ...u, ...patch }));
    updateUser(patch); // propagates to Layout immediately, busts avatar cache
  };

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Account settings</h1>
        <p className="page-subtitle">Manage your profile and security settings.</p>
      </div>

      <AvatarSection   user={currentUser} onUpdate={handleUpdate} />
      <NameSection     user={currentUser} onUpdate={u => handleUpdate({ name: u.name })} />
      <TimezoneSection user={currentUser} onUpdate={u => handleUpdate({ timezone: u.timezone })} />
      <EmailSection    user={currentUser} />
      <PasswordSection />
      <PasskeySection />
      <CalendarFeedSection />
    </div>
  );
}

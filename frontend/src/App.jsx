import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/public/LoginPage.jsx';
import ForgotPassword from './pages/public/ForgotPassword.jsx';
import RegisterPage from './pages/public/RegisterPage.jsx';
import ActivatePage from './pages/public/ActivatePage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import ConfirmEmailPage from './pages/public/ConfirmEmailPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RacesPage from './pages/races/race_listing/RacesPage.jsx';
import RaceFormPage from './pages/races/race_form/RaceFormPage.jsx';
import RaceDetailPage from './pages/races/race_detail/RaceDetailPage.jsx';
import CalendarPage from './pages/calendar/CalendarPage.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--color-text-muted)' }}>Loading…</div>;
  if (!user) {
    const intended = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(intended)}`} replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="races" element={<RacesPage />} />
            <Route path="races/new" element={<RaceFormPage />} />
            <Route path="races/:id" element={<RaceDetailPage />} />
            <Route path="races/:id/edit" element={<RaceFormPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/ical/*" element={null} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

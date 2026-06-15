import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ActivatePage from './pages/ActivatePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ConfirmEmailPage from './pages/ConfirmEmailPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RacesPage from './pages/RacesPage.jsx';
import RaceFormPage from './pages/RaceFormPage.jsx';
import RaceDetailPage from './pages/RaceDetailPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import Layout from './components/Layout.jsx';

const LoginPage = lazy(() => import('./pages/public/LoginPage.jsx'));
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword.jsx'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage.jsx'));
const ActivatePage = lazy(() => import('./pages/public/ActivatePage.jsx'));
const AdminApprovalPage = lazy(() => import('./pages/public/AdminApprovalPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage.jsx'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.jsx'));
const ConfirmEmailPage = lazy(() => import('./pages/public/ConfirmEmailPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const RacesPage = lazy(() => import('./pages/races/race_listing/RacesPage.jsx'));
const RaceFormPage = lazy(() => import('./pages/races/race_form/RaceFormPage.jsx'));
const RaceDetailPage = lazy(() => import('./pages/races/race_detail/RaceDetailPage.jsx'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage.jsx'));

function RouteFallback() {
  return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--color-text-muted)' }}>Loading…</div>;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <RouteFallback />;
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/activate" element={<ActivatePage />} />
            <Route path="/admin-approve" element={<AdminApprovalPage />} />
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

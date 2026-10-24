import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AppShell } from './components/layout/AppShell';

const CalendarPage = lazy(async () => ({ default: (await import('./pages/CalendarPage')).CalendarPage }));
const ChatPage = lazy(async () => ({ default: (await import('./pages/ChatPage')).ChatPage }));
const DashboardPage = lazy(async () => ({ default: (await import('./pages/DashboardPage')).DashboardPage }));
const LoginPage = lazy(async () => ({ default: (await import('./pages/LoginPage')).LoginPage }));
const OnboardingPage = lazy(async () => ({ default: (await import('./pages/OnboardingPage')).OnboardingPage }));
const ProfilePage = lazy(async () => ({ default: (await import('./pages/ProfilePage')).ProfilePage }));
const RadarPage = lazy(async () => ({ default: (await import('./pages/RadarPage')).RadarPage }));
const SettingsPage = lazy(async () => ({ default: (await import('./pages/SettingsPage')).SettingsPage }));
const SignupPage = lazy(async () => ({ default: (await import('./pages/SignupPage')).SignupPage }));

function AuthLoading() { return <main className="auth-loading"><div className="brand-mark" aria-hidden="true" /><span>Restoring your session…</span></main>; }
function RouteLoading() { return <main className="auth-loading" role="status"><div className="brand-mark" aria-hidden="true" /><span>Opening your campus workspace…</span></main>; }
function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function CompleteOnboarding() {
  const { user } = useAuth();
  return user?.onboardingComplete ? <Outlet /> : <Navigate to="/onboarding" replace />;
}
function OnboardingOnly() {
  const { user } = useAuth();
  return user?.onboardingComplete ? <Navigate to="/app" replace /> : <OnboardingPage />;
}
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return user ? <Navigate to={user.onboardingComplete ? '/app' : '/onboarding'} replace /> : children;
}
function NotFound() { return <main className="not-found"><div className="brand-mark" /><p className="eyebrow">404 · Off the map</p><h1>We couldn’t find that page.</h1><a className="button button-primary" href="/app">Back to your campus</a></main>; }

export function App() {
  return <Suspense fallback={<RouteLoading />}><Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
    <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
    <Route element={<ProtectedRoute />}>
      <Route path="/onboarding" element={<OnboardingOnly />} />
      <Route element={<CompleteOnboarding />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} /><Route path="radar" element={<RadarPage />} /><Route path="chat" element={<ChatPage />} />
          <Route path="calendar" element={<CalendarPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense>;
}

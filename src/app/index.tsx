import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PageTransition } from '@/components/PageTransition';
import { Layout } from './Layout';
import { BottomNav } from './BottomNav';
import { DevSwitcher } from './DevSwitcher';
import { useBackButton } from '@/lib/useBackButton';
import { useAppStore } from './store';
import { mockApiClient } from '@/mock';
import { httpApiClient } from '@/api/http';
import { isStaff } from '@/lib/permissions';
import type { MeResponse } from '@/api/types';

import { WelcomeScreen } from '@/features/onboarding/WelcomeScreen';
import { CreateGroupScreen } from '@/features/onboarding/CreateGroupScreen';
import { JoinScreen } from '@/features/onboarding/JoinScreen';
import { PendingScreen } from '@/features/onboarding/PendingScreen';
import { TodayScreen } from '@/features/schedule/TodayScreen';
import { ScheduleScreen } from '@/features/schedule/ScheduleScreen';
import { JournalScreen } from '@/features/journal/JournalScreen';
import { AnnouncementsScreen } from '@/features/announcements/AnnouncementsScreen';
import { ProfileScreen } from '@/features/settings/ProfileScreen';
import { MoreScreen } from '@/features/settings/MoreScreen';
import { StatsScreen } from '@/features/stats/StatsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { HelpScreen } from '@/features/help/HelpScreen';
import { MembersScreen } from '@/features/group/MembersScreen';
import { SecurityScreen } from '@/features/leadership/SecurityScreen';
import { AdminScreen } from '@/features/admin/AdminScreen';
import { CalendarScreen } from '@/features/schedule/CalendarScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const isMock = import.meta.env.VITE_DEV_MOCK === 'true';

function AppRoutes() {
  const me = useAppStore((s) => s.me);
  const loading = useAppStore((s) => s.loading);
  const role = me?.membership?.role ?? null;
  const hasGroup = !!me?.group && !!me?.membership;

  const location = useLocation();
  const isAuthScreen = ['/', '/create-group', '/join', '/pending'].includes(location.pathname);

  useBackButton();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="w-10 h-10 rounded-full"
          style={{
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!hasGroup && !isAuthScreen) {
    return <Navigate to="/" replace />;
  }

  if (hasGroup && isAuthScreen && location.pathname !== '/pending') {
    return <Navigate to="/today" replace />;
  }

  const showBottomNav = hasGroup && !isAuthScreen;

  return (
    <>
      {isMock && <DevSwitcher />}
      {showBottomNav && role && <BottomNav role={role} />}
      <PageTransition>
        <Routes location={location}>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/create-group" element={<CreateGroupScreen />} />
          <Route path="/join" element={<JoinScreen />} />
          <Route path="/pending" element={<PendingScreen />} />
          {hasGroup && (
            <>
              <Route path="/today" element={<Layout><TodayScreen /></Layout>} />
              <Route path="/schedule" element={<Layout><ScheduleScreen /></Layout>} />
              {isStaff(role ?? 'student') && (
                <Route path="/journal" element={<Layout><JournalScreen /></Layout>} />
              )}
              <Route path="/announcements" element={<Layout><AnnouncementsScreen /></Layout>} />
              <Route path="/profile" element={<Layout><ProfileScreen /></Layout>} />
              <Route path="/more" element={<Layout><MoreScreen /></Layout>} />
              <Route path="/stats" element={<Layout><StatsScreen /></Layout>} />
              <Route path="/settings" element={<Layout><SettingsScreen /></Layout>} />
              <Route path="/help" element={<Layout><HelpScreen /></Layout>} />
              <Route path="/members" element={<Layout><MembersScreen /></Layout>} />
              <Route path="/security" element={<Layout><SecurityScreen /></Layout>} />
              <Route path="/calendar" element={<Layout><CalendarScreen /></Layout>} />
              <Route path="/admin" element={<Layout><AdminScreen /></Layout>} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </>
  );
}

function AppInner() {
  const setClient = useAppStore((s) => s.setClient);
  const setMe = useAppStore((s) => s.setMe);
  const setLoading = useAppStore((s) => s.setLoading);

  useEffect(() => {
    const client = isMock ? mockApiClient : httpApiClient;
    setClient(client, isMock);

    if (isMock) {
      setLoading(true);
      client.getMe().then((me: MeResponse) => {
        setMe(me);
        setLoading(false);
      });
    }
  }, [setClient, setMe, setLoading]);

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

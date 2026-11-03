import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useTheme } from '@/components/ThemeProvider';
import type { Background, Theme } from '@/components/ThemeProvider';
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
import { getInitData } from '@/lib/telegram';
import { ErrorState } from '@/components/ui';

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
const themeOptions: Theme[] = ['dark', 'light', 'forest', 'sky', 'pink', 'red'];
const backgroundOptions: Background[] = ['gradient', 'particles', 'scene', 'minimal', 'parallax'];

function AppRoutes() {
  const me = useAppStore((s) => s.me);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const role = me?.membership?.role ?? null;
  const hasGroup = !!me?.group && me?.membership?.status === 'active';
  const isPending = me?.membership?.status === 'pending';

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

  if (error && !me && !isMock) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (isPending && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  if (!hasGroup && !isPending && !isAuthScreen) {
    return <Navigate to="/" replace />;
  }

  if (hasGroup && isAuthScreen) {
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
  const setError = useAppStore((s) => s.setError);
  const me = useAppStore((s) => s.me);
  const { reduceMotion, setTheme, setBackground, setReduceMotion } = useTheme();

  useEffect(() => {
    if (!me?.user) return;
    if (themeOptions.includes(me.user.theme as Theme)) setTheme(me.user.theme as Theme);
    if (backgroundOptions.includes(me.user.background as Background)) setBackground(me.user.background as Background);
    setReduceMotion(me.user.reduce_motion);
  }, [me?.user?.theme, me?.user?.background, me?.user?.reduce_motion, setTheme, setBackground, setReduceMotion]);

  useEffect(() => {
    const client = isMock ? mockApiClient : httpApiClient;
    setClient(client, isMock);

    if (!isMock && !getInitData().trim()) {
      setMe(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    client.getMe()
      .then((me: MeResponse) => {
        if (cancelled) return;
        setMe(me);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setMe(null);
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить профиль');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [setClient, setMe, setLoading, setError]);

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </MotionConfig>
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

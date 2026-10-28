import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ClipboardList, Home, Megaphone, MoreHorizontal, User } from 'lucide-react';
import { ru } from '@/i18n/ru';
import type { Role } from '@/lib/permissions';
import { haptic } from '@/lib/telegram';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

function studentNav(): NavItem[] {
  return [
    { path: '/today', label: ru.nav.today, icon: Home },
    { path: '/schedule', label: ru.nav.schedule, icon: Calendar },
    { path: '/announcements', label: ru.nav.announcements, icon: Megaphone },
    { path: '/profile', label: ru.nav.profile, icon: User },
  ];
}

function staffNav(): NavItem[] {
  return [
    { path: '/today', label: ru.nav.today, icon: Home },
    { path: '/schedule', label: ru.nav.schedule, icon: Calendar },
    { path: '/journal', label: ru.nav.journal, icon: ClipboardList },
    { path: '/announcements', label: ru.nav.announcements, icon: Megaphone },
    { path: '/more', label: ru.nav.more, icon: MoreHorizontal },
  ];
}

export function BottomNav({ role }: { role: Role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = role === 'student' ? studentNav() : staffNav();

  const activeIndex = items.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.15 }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around h-16 relative">
        {items.map((item, index) => {
          const active = index === activeIndex;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => {
                haptic('light');
                navigate(item.path);
              }}
              className="relative flex flex-col items-center gap-1 px-3 py-2 transition-colors duration-200"
              style={{ opacity: active ? 1 : 0.5 }}
              aria-label={item.label}
            >
              {active && (
                <motion.div
                  layoutId="navActiveBg"
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {active && (
                <motion.div
                  layoutId="navActiveDot"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--primary)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                />
              )}
              <motion.div
                animate={{
                  scale: active ? 1.1 : 1,
                  y: active ? -1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="relative z-10"
              >
                <Icon
                  size={22}
                  color={active ? 'var(--primary)' : 'var(--muted)'}
                  strokeWidth={active ? 2.5 : 2}
                />
              </motion.div>
              <span
                className="text-[10px] leading-none font-medium relative z-10"
                style={{ color: active ? 'var(--primary)' : 'var(--muted)' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}

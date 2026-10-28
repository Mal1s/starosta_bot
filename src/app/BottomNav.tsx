import { useNavigate, useLocation } from 'react-router-dom';
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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around h-16">
        {items.map((item) => {
          const active = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => {
                haptic('light');
                navigate(item.path);
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 transition-opacity"
              style={{ opacity: active ? 1 : 0.5 }}
              aria-label={item.label}
            >
              <Icon
                size={22}
                color={active ? 'var(--primary)' : 'var(--muted)'}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className="text-[10px] leading-none font-medium"
                style={{ color: active ? 'var(--primary)' : 'var(--muted)' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

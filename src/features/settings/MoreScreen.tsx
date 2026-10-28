import { useNavigate } from 'react-router-dom';
import { Users, BarChart3, Settings, Shield, HelpCircle, Calendar } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { isHeadman } from '@/lib/permissions';

export function MoreScreen() {
  const navigate = useNavigate();
  const me = useAppStore((s) => s.me);
  const role = me?.membership?.role ?? 'student';

  const items: { icon: typeof Users; label: string; path: string; headmanOnly?: boolean }[] = [
    { icon: Users, label: 'Участники', path: '/members' },
    { icon: BarChart3, label: 'Статистика', path: '/stats' },
    { icon: Calendar, label: ru.settings.calendar, path: '/calendar' },
    { icon: Settings, label: ru.profile.settings, path: '/settings' },
    { icon: Shield, label: ru.settings.security, path: '/security', headmanOnly: true },
    { icon: HelpCircle, label: ru.profile.help, path: '/help' },
  ];

  const visibleItems = items.filter((i) => !i.headmanOnly || isHeadman(role));

  return (
    <div>
      <ScreenHeader title={ru.nav.more} />
      <div className="space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <Icon size={20} color="var(--muted)" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

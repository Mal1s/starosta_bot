import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, BarChart3, Settings, Shield, HelpCircle, Calendar, ChevronRight } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isHeadman } from '@/lib/permissions';
import { haptic } from '@/lib/telegram';

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
      <StaggerGroup className="space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <StaggerItem key={item.path}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                onClick={() => {
                  haptic('light');
                  navigate(item.path);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--surface-2)' }}
                >
                  <Icon size={18} color="var(--muted)" />
                </div>
                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                <ChevronRight size={18} color="var(--muted)" />
              </motion.button>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </div>
  );
}

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useTheme, type Theme, type Background } from '@/components/ThemeProvider';
import { useAppStore } from '@/app/store';
import { haptic } from '@/lib/telegram';

const themes: { key: Theme; label: string; color: string }[] = [
  { key: 'dark', label: 'Тёмная', color: '#0B0F1A' },
  { key: 'light', label: 'Светлая', color: '#F5F7FB' },
  { key: 'forest', label: 'Лес', color: '#0C1A12' },
  { key: 'sky', label: 'Голубая', color: '#EAF6FF' },
  { key: 'pink', label: 'Розовая', color: '#FFF1F6' },
  { key: 'red', label: 'Красная', color: '#1A0B0E' },
];

const backgrounds: { key: Background; label: string }[] = [
  { key: 'gradient', label: 'Градиент' },
  { key: 'minimal', label: 'Минимал' },
  { key: 'particles', label: 'Частицы' },
  { key: 'scene', label: 'Сцена' },
  { key: 'parallax', label: 'Параллакс' },
];

export function SettingsScreen() {
  const { theme, background, reduceMotion, setTheme, setBackground, setReduceMotion } = useTheme();
  const me = useAppStore((s) => s.me);

  return (
    <div>
      <ScreenHeader title={ru.profile.settings} />

      <StaggerGroup className="space-y-3">
        <StaggerItem>
          <Card>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>{ru.settings.theme}</p>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => (
                <motion.button
                  key={t.key}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    haptic('light');
                    setTheme(t.key);
                  }}
                  className="relative py-2.5 rounded-xl text-xs font-medium transition-colors overflow-hidden"
                  style={{
                    backgroundColor: theme === t.key ? 'var(--primary)' : 'var(--surface-2)',
                    color: theme === t.key ? '#fff' : 'var(--text)',
                  }}
                >
                  <div
                    className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border"
                    style={{ backgroundColor: t.color, borderColor: 'var(--border)' }}
                  />
                  {t.label}
                  {theme === t.key && (
                    <Check size={12} className="absolute right-1.5 top-1.5" />
                  )}
                </motion.button>
              ))}
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>{ru.settings.background}</p>
            <div className="grid grid-cols-3 gap-2">
              {backgrounds.map((b) => (
                <motion.button
                  key={b.key}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    haptic('light');
                    setBackground(b.key);
                  }}
                  className="py-2.5 rounded-xl text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: background === b.key ? 'var(--primary)' : 'var(--surface-2)',
                    color: background === b.key ? '#fff' : 'var(--text)',
                  }}
                >
                  {b.label}
                </motion.button>
              ))}
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm" style={{ color: 'var(--text)' }}>{ru.settings.reduceMotion}</span>
              <motion.div
                onClick={() => {
                  haptic('light');
                  setReduceMotion(!reduceMotion);
                }}
                className="relative w-12 h-7 rounded-full"
                style={{ backgroundColor: reduceMotion ? 'var(--primary)' : 'var(--surface-2)' }}
              >
                <motion.div
                  animate={{ x: reduceMotion ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 rounded-full bg-white"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                />
              </motion.div>
            </label>
          </Card>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}

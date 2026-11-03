import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
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
  const client = useAppStore((s) => s.client);
  const [saveError, setSaveError] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (input: { theme?: string; background?: string; reduce_motion?: boolean }) => {
      if (!client) throw new Error('API client is unavailable');
      return client.updateMeSettings(input);
    },
    onSuccess: () => setSaveError(false),
    onError: () => setSaveError(true),
  });

  useEffect(() => {
    if (!me?.user) return;
    if (themes.some((item) => item.key === me.user.theme)) setTheme(me.user.theme as Theme);
    if (backgrounds.some((item) => item.key === me.user.background)) setBackground(me.user.background as Background);
    setReduceMotion(me.user.reduce_motion);
  }, [me?.user?.theme, me?.user?.background, me?.user?.reduce_motion, setBackground, setReduceMotion, setTheme]);

  function selectTheme(value: Theme) {
    setTheme(value);
    saveMutation.mutate({ theme: value });
  }

  function selectBackground(value: Background) {
    setBackground(value);
    saveMutation.mutate({ background: value });
  }

  function toggleReducedMotion() {
    const nextValue = !reduceMotion;
    setReduceMotion(nextValue);
    saveMutation.mutate({ reduce_motion: nextValue });
  }

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
                  disabled={saveMutation.isPending}
                  aria-pressed={theme === t.key}
                  onClick={() => {
                    haptic('light');
                    selectTheme(t.key);
                  }}
                  className="relative py-2.5 rounded-xl text-xs font-medium transition-colors overflow-hidden"
                  style={{
                    backgroundColor: theme === t.key ? 'var(--primary)' : 'var(--surface-2)',
                    color: theme === t.key ? 'var(--primary-foreground)' : 'var(--text)',
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
                  disabled={saveMutation.isPending}
                  aria-pressed={background === b.key}
                  onClick={() => {
                    haptic('light');
                    selectBackground(b.key);
                  }}
                  className="py-2.5 rounded-xl text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: background === b.key ? 'var(--primary)' : 'var(--surface-2)',
                    color: background === b.key ? 'var(--primary-foreground)' : 'var(--text)',
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{ru.settings.reduceMotion}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Отключить движение и переходы</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reduceMotion}
                aria-label={ru.settings.reduceMotion}
                disabled={saveMutation.isPending}
                onClick={() => {
                  haptic('light');
                  toggleReducedMotion();
                }}
                className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
                style={{ backgroundColor: reduceMotion ? 'var(--primary)' : 'var(--surface-2)' }}
              >
                <motion.div
                  animate={{ x: reduceMotion ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 rounded-full bg-white"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                />
              </button>
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>
      {saveError && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>{ru.error.generic}</p>}
    </div>
  );
}

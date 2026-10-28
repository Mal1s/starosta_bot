import { ru } from '@/i18n/ru';
import { ScreenHeader, Card } from '@/components/ui';
import { useTheme, type Theme, type Background } from '@/components/ThemeProvider';
import { useAppStore } from '@/app/store';

const themes: { key: Theme; label: string }[] = [
  { key: 'dark', label: 'Тёмная' },
  { key: 'light', label: 'Светлая' },
  { key: 'forest', label: 'Лес' },
  { key: 'sky', label: 'Голубая' },
  { key: 'pink', label: 'Розовая' },
  { key: 'red', label: 'Красная' },
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

      <Card className="mb-3">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>{ru.settings.theme}</p>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className="py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: theme === t.key ? 'var(--primary)' : 'var(--surface-2)',
                color: theme === t.key ? '#fff' : 'var(--text)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-3">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>{ru.settings.background}</p>
        <div className="grid grid-cols-3 gap-2">
          {backgrounds.map((b) => (
            <button
              key={b.key}
              onClick={() => setBackground(b.key)}
              className="py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: background === b.key ? 'var(--primary)' : 'var(--surface-2)',
                color: background === b.key ? '#fff' : 'var(--text)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm" style={{ color: 'var(--text)' }}>{ru.settings.reduceMotion}</span>
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
            className="w-5 h-5"
            style={{ accentColor: 'var(--primary)' }}
          />
        </label>
      </Card>
    </div>
  );
}

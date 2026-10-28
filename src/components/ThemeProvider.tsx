import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'forest' | 'sky' | 'pink' | 'red';
type Background = 'gradient' | 'particles' | 'scene' | 'minimal' | 'parallax';

interface ThemeContextValue {
  theme: Theme;
  background: Background;
  reduceMotion: boolean;
  setTheme: (t: Theme) => void;
  setBackground: (b: Background) => void;
  setReduceMotion: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const val = localStorage.getItem(key);
  return (val as T) || fallback;
}

function writeStored(key: string, value: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStored('app-theme', 'dark'));
  const [background, setBackgroundState] = useState<Background>(() => readStored('app-bg', 'gradient'));
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => readStored('app-reduce-motion', 'false') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => { setThemeState(t); writeStored('app-theme', t); };
  const setBackground = (b: Background) => { setBackgroundState(b); writeStored('app-bg', b); };
  const setReduceMotion = (v: boolean) => { setReduceMotionState(v); writeStored('app-reduce-motion', String(v)); };

  return (
    <ThemeContext.Provider value={{ theme, background, reduceMotion, setTheme, setBackground, setReduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export type { Theme, Background };

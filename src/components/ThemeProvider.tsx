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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [background, setBackground] = useState<Background>('gradient');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

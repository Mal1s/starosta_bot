import { type ReactNode } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { BackgroundCanvas } from '@/components/BackgroundCanvas';

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  const { background, reduceMotion } = useTheme();

  return (
    <div className="min-h-screen flex flex-col" style={{ color: 'var(--text)' }}>
      <BackgroundCanvas background={background} reduceMotion={reduceMotion} />
      <main
        className="flex-1 mx-auto w-full max-w-md px-4 pb-20"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
        }}
      >
        {children}
      </main>
    </div>
  );
}

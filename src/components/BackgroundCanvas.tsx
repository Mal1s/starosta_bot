import { useEffect, useRef } from 'react';
import { useTheme, type Background } from './ThemeProvider';

interface Props {
  background: Background;
  reduceMotion: boolean;
}

export function BackgroundCanvas({ background, reduceMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shouldAnimate = !reduceMotion && !prefersReducedMotion;
  const effectiveBg = shouldAnimate ? background : 'minimal';

  useEffect(() => {
    if (effectiveBg !== 'particles' && effectiveBg !== 'scene') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = [];
    const colors = [
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4D8DFF',
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22D3EE',
    ];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const count = effectiveBg === 'particles' ? 60 : 30;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.15;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animate);
    }
    animate();

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(animate);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [effectiveBg]);

  if (effectiveBg === 'minimal') {
    return <div className="fixed inset-0 -z-10" style={{ backgroundColor: 'var(--bg)' }} />;
  }

  if (effectiveBg === 'gradient') {
    return (
      <div
        className="fixed inset-0 -z-10 animated-gradient"
        style={{
          background:
            'linear-gradient(135deg, var(--bg) 0%, var(--surface-2) 50%, var(--bg) 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradientBreath 40s ease-in-out infinite',
        }}
      />
    );
  }

  if (effectiveBg === 'parallax') {
    return (
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)' }} />
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 20% 30%, var(--primary) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 80% 70%, var(--accent) 0%, transparent 50%)' }} />
      </div>
    );
  }

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" />;
}

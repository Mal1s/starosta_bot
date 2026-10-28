import { type ReactNode, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { haptic } from '@/lib/telegram';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className="pt-6 pb-4"
    >
      <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

export function Card({
  children,
  className = '',
  delay = 0,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1], delay }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`rounded-2xl p-4 ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </motion.div>
  );
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

let rippleId = 0;

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  fullWidth,
  size = 'md',
  className = '',
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  loading?: boolean;
}) {
  const ripplesRef = useRef<Ripple[]>([]);
  const ripplesSetRef = useRef<Set<number>>(new Set());

  const bgMap: Record<string, string> = {
    primary: 'var(--primary)',
    secondary: 'var(--surface-2)',
    danger: 'var(--danger)',
    ghost: 'transparent',
  };
  const colorMap: Record<string, string> = {
    primary: '#FFFFFF',
    secondary: 'var(--text)',
    danger: '#FFFFFF',
    ghost: 'var(--text)',
  };
  const sizeMap: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    haptic('light');

    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId++;
    const ripple = {
      id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    ripplesRef.current.push(ripple);
    ripplesSetRef.current.add(id);

    setTimeout(() => {
      ripplesRef.current = ripplesRef.current.filter((r) => r.id !== id);
      ripplesSetRef.current.delete(id);
    }, 600);

    onClick?.();
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={`relative overflow-hidden rounded-xl font-medium ${sizeMap[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{
        backgroundColor: bgMap[variant],
        color: colorMap[variant],
        border: variant === 'ghost' ? `1px solid var(--border)` : 'none',
        minHeight: '44px',
        opacity: disabled || loading ? 0.5 : 1,
      }}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: bgMap[variant] }}>
          <Loader2 size={18} className="animate-spin" color={colorMap[variant]} />
        </span>
      )}
      <span className={loading ? 'invisible' : 'visible'}>{children}</span>
    </motion.button>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin" color="var(--muted)" />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div
        className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-2)' }}
      >
        <div
          className="w-8 h-8 rounded-full"
          style={{
            border: '2px solid var(--border)',
            borderTopColor: 'var(--muted)',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
      <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
        {title}
      </p>
      {hint && (
        <p className="text-sm mt-2 max-w-xs" style={{ color: 'var(--muted)' }}>
          {hint}
        </p>
      )}
    </motion.div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <p className="text-base" style={{ color: 'var(--danger)' }}>{ru.error.generic}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {ru.error.retry}
        </Button>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 shimmer-bg" style={{ border: '1px solid var(--border)' }}>
      <div className="h-4 w-3/4 rounded mb-3" style={{ backgroundColor: 'var(--surface-2)' }} />
      <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
    </div>
  );
}

export function Badge({ children, color = 'primary' }: { children: ReactNode; color?: 'primary' | 'success' | 'danger' | 'warning' | 'accent' }) {
  const colorMap: Record<string, string> = {
    primary: 'var(--primary)',
    success: 'var(--success)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    accent: 'var(--accent)',
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: `${colorMap[color]}20`, color: colorMap[color] }}
    >
      {children}
    </span>
  );
}

export function IconButton({
  icon: Icon,
  onClick,
  label,
  variant = 'ghost',
}: {
  icon: typeof Loader2;
  onClick?: () => void;
  label: string;
  variant?: 'ghost' | 'primary' | 'danger';
}) {
  const colorMap: Record<string, string> = {
    ghost: 'var(--text)',
    primary: 'var(--primary)',
    danger: 'var(--danger)',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      onClick={() => {
        haptic('light');
        onClick?.();
      }}
      aria-label={label}
      className="flex items-center justify-center w-10 h-10 rounded-xl"
      style={{
        backgroundColor: variant === 'ghost' ? 'transparent' : `${colorMap[variant]}15`,
        color: colorMap[variant],
      }}
    >
      <Icon size={20} />
    </motion.button>
  );
}

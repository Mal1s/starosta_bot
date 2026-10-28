import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ru } from '@/i18n/ru';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-6 pb-4">
      <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  fullWidth,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const bgMap = {
    primary: 'var(--primary)',
    secondary: 'var(--surface-2)',
    danger: 'var(--danger)',
    ghost: 'transparent',
  };
  const colorMap = {
    primary: '#FFFFFF',
    secondary: 'var(--text)',
    danger: '#FFFFFF',
    ghost: 'var(--text)',
  };
  const sizeMap = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${sizeMap[size]} ${fullWidth ? 'w-full' : ''}`}
      style={{
        backgroundColor: bgMap[variant],
        color: colorMap[variant],
        border: variant === 'ghost' ? `1px solid var(--border)` : 'none',
        minHeight: '44px',
      }}
    >
      {children}
    </button>
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full mb-4" style={{ backgroundColor: 'var(--surface-2)' }} />
      <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
        {title}
      </p>
      {hint && (
        <p className="text-sm mt-2 max-w-xs" style={{ color: 'var(--muted)' }}>
          {hint}
        </p>
      )}
    </div>
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
    <div className="rounded-2xl p-4 animate-pulse" style={{ backgroundColor: 'var(--surface)' }}>
      <div className="h-4 w-3/4 rounded mb-3" style={{ backgroundColor: 'var(--surface-2)' }} />
      <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
    </div>
  );
}

export function Badge({ children, color = 'primary' }: { children: ReactNode; color?: 'primary' | 'success' | 'danger' | 'warning' }) {
  const colorMap = {
    primary: 'var(--primary)',
    success: 'var(--success)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',
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

'use client';

import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export type ThemeStatVariant = 'info' | 'success' | 'warning' | 'neutral' | 'brand';

const VARIANT_CLASS: Record<ThemeStatVariant, string> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  neutral: 'neutral',
  brand: 'accent',
};

/** Map legacy stat color names to theme semantic variants */
export function legacyStatColor(color: 'blue' | 'purple' | 'green' | 'orange'): ThemeStatVariant {
  if (color === 'blue') return 'info';
  if (color === 'green') return 'success';
  if (color === 'orange') return 'warning';
  return 'neutral';
}

type ThemeStatCardProps = {
  icon: React.ElementType;
  title: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  footnote?: string;
  variant?: ThemeStatVariant;
  className?: string;
};

export function ThemeStatCard({
  icon: Icon,
  title,
  value,
  delta,
  footnote,
  variant = 'neutral',
  className = '',
}: ThemeStatCardProps) {
  const v = VARIANT_CLASS[variant];
  return (
    <div className={`c-stat ${v} ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="c-stat-label">
          <Icon className="w-3.5 h-3.5 opacity-80" />
          {title}
        </div>
        {delta != null && <div className="text-[11px] text-muted">{delta}</div>}
      </div>
      <div className="c-stat-value">{value}</div>
      {footnote && <p className="text-[11px] text-muted mt-2">{footnote}</p>}
    </div>
  );
}

type ThemeFilterTabProps = {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export function ThemeFilterTab({ active, children, onClick, className = '' }: ThemeFilterTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`c-filter-tab ${active ? 'active' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function ThemePageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="surface-1 border-b border-line px-8 py-6 sticky top-0 z-20" style={{ borderColor: 'var(--c-border)' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-secondary">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

export function ThemeAvatar({
  initials,
  className = '',
}: {
  initials: string;
  className?: string;
}) {
  return (
    <div className={`c-avatar ${className}`}>
      {initials}
    </div>
  );
}

export function themeDelta(change: number, previousLabel: string): React.ReactNode {
  const isPositive = change > 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  return (
    <span className={isPositive ? 'c-stat-delta-up inline-flex items-center gap-0.5' : 'c-stat-delta-down inline-flex items-center gap-0.5'}>
      <Icon className="w-3 h-3" />
      {Math.abs(change).toFixed(1)}%
      {previousLabel && <span className="font-normal ml-1 opacity-80">{previousLabel}</span>}
    </span>
  );
}

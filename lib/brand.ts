/**
 * Coursify design tokens — from coursify - logo and design/coursify-theme.css
 */

export const BRAND = {
  accent: '#ff6b35',
  accentHover: '#e85520',
  yellow: '#d4ff47',
  ink: '#080808',
  markBg: '#161616',
  markBorder: '#242424',
  info: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

export const BRAND_ASSETS = {
  mark: '/brand/coursify-mark.svg',
  compact: '/brand/coursify-compact.svg',
  compactLight: '/brand/coursify-light.svg',
  primary: '/brand/coursify-primary.svg',
  themeReference: '/brand/coursify-theme.css',
} as const;

/** Tailwind / CSS variable names (see app/globals.css) */
export const THEME_VARS = {
  bgBase: 'var(--bg-base)',
  bgSurface: 'var(--bg-surface)',
  bgRaised: 'var(--bg-raised)',
  border: 'var(--border)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  accent: 'var(--accent)',
} as const;

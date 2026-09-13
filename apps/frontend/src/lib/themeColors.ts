/**
 * Shared semantic color tokens for inline styles in TSX files.
 *
 * These map to CSS custom properties defined in index.css so inline
 * styles automatically adapt to light / dark theme without needing
 * per-component [data-theme="dark"] overrides.
 */

export const STATUS = {
  error: 'var(--status-error)',
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
} as const;

export const ACCENT = {
  primary: 'var(--accent-primary)',
  hover: 'var(--accent-hover)',
  soft: 'var(--accent-soft)',
} as const;

export const TEXT = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  tertiary: 'var(--text-tertiary)',
} as const;

/**
 * Q8 Design System - Design Tokens v2.0
 *
 * These tokens define the visual language of Q8:
 * - Dark theme with glassmorphism accents
 * - OKLCH color space for perceptual uniformity
 * - Neon accents used sparingly for emphasis
 */

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * Typography scale (px values converted to rem)
 */
export const typography = {
  text: {
    xs: '0.75rem',      // 12px
    sm: '0.8125rem',    // 13px
    base: '0.875rem',   // 14px
    lg: '1rem',         // 16px
    xl: '1.125rem',     // 18px
    '2xl': '1.375rem',  // 22px
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// =============================================================================
// SPACING
// =============================================================================

/**
 * Spacing scale (4px base unit)
 */
export const spacing = {
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

/**
 * Border radius scale
 */
export const borderRadius = {
  sm: '0.5rem',   // 8px
  md: '0.75rem',  // 12px
  lg: '1rem',     // 16px
  xl: '1.5rem',   // 24px
  full: '9999px',
} as const;

// =============================================================================
// COLORS
// =============================================================================

/**
 * Surface colors (calm matte base)
 * Using OKLCH color space for perceptual uniformity
 */
export const surfaces = {
  /** App background, low contrast */
  surface1: 'oklch(12% 0.01 260)',
  /** Widget/content containers, calm matte */
  surface2: 'oklch(16% 0.015 260)',
  /** Glass highlight, used sparingly */
  surface3: 'oklch(100% 0 0 / 0.08)',
  /** Hover/active overlays */
  surface4: 'oklch(100% 0 0 / 0.12)',
} as const;

/**
 * Border colors
 */
export const borders = {
  /** Thin, low-contrast stroke */
  subtle: 'oklch(100% 0 0 / 0.08)',
  /** Active/selected states */
  strong: 'oklch(100% 0 0 / 0.2)',
  /** Neon accent border */
  accent: 'oklch(65% 0.2 260 / 0.5)',
} as const;

/**
 * Neon accent colors
 */
export const neon = {
  /** Electric Purple - primary accent */
  primary: 'oklch(65% 0.2 260)',
  /** Cyber Green - secondary accent */
  accent: 'oklch(80% 0.3 140)',
} as const;

/**
 * Text colors
 */
export const text = {
  /** High contrast text */
  primary: 'oklch(98% 0 0)',
  /** Medium contrast text */
  secondary: 'oklch(75% 0 0)',
  /** Low contrast text (meets 4.5:1 WCAG) */
  muted: 'oklch(55% 0 0)',
} as const;

/**
 * State/semantic colors
 */
export const semantic = {
  success: 'oklch(70% 0.2 145)',   // Green
  warning: 'oklch(75% 0.18 75)',   // Amber
  danger: 'oklch(60% 0.25 25)',    // Red
  info: 'oklch(70% 0.15 230)',     // Blue
} as const;

/**
 * Glass effect tokens
 */
export const glass = {
  background: 'oklch(100% 0 0 / 0.08)',
  border: 'oklch(100% 0 0 / 0.15)',
  blur: '24px',
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

/**
 * Shadow/elevation tiers
 */
export const shadows = {
  /** Subtle depth */
  shadow1: '0 1px 2px oklch(0% 0 0 / 0.1)',
  /** Card-level elevation */
  shadow2: '0 4px 12px oklch(0% 0 0 / 0.15)',
  /** Modal/overlay elevation */
  shadow3: '0 8px 30px oklch(0% 0 0 / 0.2)',
  /** Neon glow effect */
  neon: '0 0 20px oklch(65% 0.2 260 / 0.5)',
} as const;

// =============================================================================
// FOCUS & SELECTION
// =============================================================================

export const focus = {
  ring: '0 0 0 2px oklch(65% 0.2 260 / 0.5)',
  selectionBg: 'oklch(65% 0.2 260 / 0.15)',
} as const;

// =============================================================================
// LAYOUT TOKENS
// =============================================================================

/**
 * Widget layout standards
 */
export const layout = {
  widgetPadding: spacing[4],       // 16px content padding
  headerPadding: spacing[3],       // 12px header padding
  gridGap: {
    desktop: spacing[4],           // 16px
    tablet: spacing[3],            // 12px
    mobile: spacing[2],            // 8px
  },
} as const;

// =============================================================================
// ANIMATION
// =============================================================================

/**
 * Animation timing
 */
export const animation = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  easing: {
    default: 'ease-out',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// =============================================================================
// CSS VARIABLES
// =============================================================================

/**
 * CSS variable names for use in stylesheets
 * These map to the values defined in globals.css
 */
export const cssVariables = {
  // Surfaces
  surface1: 'var(--surface-1)',
  surface2: 'var(--surface-2)',
  surface3: 'var(--surface-3)',
  surface4: 'var(--surface-4)',

  // Borders
  borderSubtle: 'var(--border-subtle)',
  borderStrong: 'var(--border-strong)',
  borderAccent: 'var(--border-accent)',

  // Text
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',

  // Neon
  neonPrimary: 'var(--color-neon-primary)',
  neonAccent: 'var(--color-neon-accent)',

  // Semantic
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',

  // Glass
  glassBg: 'var(--color-glass-bg)',
  glassBorder: 'var(--color-glass-border)',
  blurGlass: 'var(--blur-glass)',

  // Shadows
  shadow1: 'var(--shadow-1)',
  shadow2: 'var(--shadow-2)',
  shadow3: 'var(--shadow-3)',

  // Layout
  widgetPadding: 'var(--widget-padding)',
  headerPadding: 'var(--widget-header-padding)',
  gridGapDesktop: 'var(--grid-gap-desktop)',
  gridGapTablet: 'var(--grid-gap-tablet)',
  gridGapMobile: 'var(--grid-gap-mobile)',

  // Spacing
  space1: 'var(--space-1)',
  space2: 'var(--space-2)',
  space3: 'var(--space-3)',
  space4: 'var(--space-4)',
  space5: 'var(--space-5)',
  space6: 'var(--space-6)',
  space8: 'var(--space-8)',

  // Radius
  radiusSm: 'var(--radius-sm)',
  radiusMd: 'var(--radius-md)',
  radiusLg: 'var(--radius-lg)',
  radiusXl: 'var(--radius-xl)',
} as const;

// =============================================================================
// COMBINED EXPORTS
// =============================================================================

/**
 * All design tokens combined
 */
export const tokens = {
  typography,
  spacing,
  borderRadius,
  surfaces,
  borders,
  neon,
  text,
  semantic,
  glass,
  shadows,
  focus,
  layout,
  animation,
  cssVariables,
} as const;

export type Tokens = typeof tokens;

/**
 * iOS-style spring physics presets for framer-motion.
 * Single source of truth for all animation curves in Q8.
 */

/** General purpose -- cards, modals, most UI */
export const springDefault = { type: 'spring' as const, stiffness: 300, damping: 26 };

/** Sheets, page transitions -- smooth and gentle */
export const springGentle = { type: 'spring' as const, stiffness: 200, damping: 24 };

/** Toggles, tab switches -- fast and crisp */
export const springSnappy = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 };

/** FAB, success states -- playful with slight overshoot */
export const springBouncy = { type: 'spring' as const, stiffness: 500, damping: 25, mass: 0.8 };

/** Drag release, sheet snap -- heavier feel */
export const springHeavy = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 1.2 };

/** Toggle thumbs, checkmarks -- ultra-fast micro movements */
export const springMicro = { type: 'spring' as const, stiffness: 600, damping: 35, mass: 0.5 };

/** All spring presets as a map */
export const springs = {
  default: springDefault,
  gentle: springGentle,
  snappy: springSnappy,
  bouncy: springBouncy,
  heavy: springHeavy,
  micro: springMicro,
} as const;

/**
 * Check if user prefers reduced motion.
 * Returns true if animations should be disabled/minimized.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns the spring config or instant transition if reduced motion is preferred.
 */
export function safeSpring(spring: typeof springDefault) {
  if (prefersReducedMotion()) {
    return { type: 'tween' as const, duration: 0 };
  }
  return spring;
}

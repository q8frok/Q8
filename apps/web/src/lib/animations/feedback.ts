import { haptics } from '@/lib/pwa/haptics';

/**
 * Success pop: scale up briefly then return + haptic.
 * Use with framer-motion animate().
 */
export const successPop = {
  keyframes: { scale: [1, 1.15, 1] },
  transition: { duration: 0.3 },
  onStart: () => haptics.success(),
};

/**
 * Error shake: horizontal shake + haptic.
 */
export const errorShake = {
  keyframes: { x: [0, -8, 8, -4, 4, 0] },
  transition: { duration: 0.4 },
  onStart: () => haptics.error(),
};

/**
 * Loading pulse: gentle opacity breathing.
 */
export const loadingPulse = {
  animate: { opacity: [1, 0.5, 1] },
  transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
};

/**
 * Tap scale for buttons - use as whileTap prop.
 */
export const tapScale = { scale: 0.97 };

/**
 * Tap scale for smaller interactive elements.
 */
export const tapScaleSmall = { scale: 0.93 };

/**
 * Spring rotation for refresh icons (360 degrees).
 */
export const refreshSpin = {
  animate: { rotate: 360 },
  transition: { duration: 0.6, ease: 'easeInOut' as const },
};

/**
 * Chat message entrance from right (user messages).
 */
export const messageFromRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

/**
 * Chat message entrance from left (assistant messages).
 */
export const messageFromLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

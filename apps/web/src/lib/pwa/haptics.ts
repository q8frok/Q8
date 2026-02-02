/**
 * Haptic Feedback Utility
 * Provides vibration patterns for different UI interactions
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'snap' | 'tap' | 'impact';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [30, 100, 30, 100, 30],
  selection: 5,
  snap: 8,       // Bottom sheet snap, scroll snap
  tap: 5,        // Lightweight UI taps
  impact: 15,    // Button presses, confirmations
};

export function triggerHaptic(pattern: HapticPattern = 'light'): void {
  if (!('vibrate' in navigator)) {
    return;
  }

  try {
    const vibrationPattern = PATTERNS[pattern];
    navigator.vibrate(vibrationPattern);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}

export function cancelHaptic(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

export const haptics = {
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  heavy: () => triggerHaptic('heavy'),
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
  selection: () => triggerHaptic('selection'),
  snap: () => triggerHaptic('snap'),
  tap: () => triggerHaptic('tap'),
  impact: () => triggerHaptic('impact'),
  cancel: cancelHaptic,
};

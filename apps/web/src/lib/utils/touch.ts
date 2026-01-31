/**
 * Touch Interaction Utilities
 * Optimized gesture handling for mobile devices
 */

import { haptics } from '@/lib/pwa/haptics';

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  duration: number;
}

export interface TouchHandlers {
  onSwipe?: (gesture: SwipeGesture) => void;
  onTap?: (e: TouchEvent) => void;
  onLongPress?: (e: TouchEvent) => void;
  onDoubleTap?: (e: TouchEvent) => void;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const LONG_PRESS_DURATION = 500;
const DOUBLE_TAP_DELAY = 300;

export function useTouchGestures(element: HTMLElement | null, handlers: TouchHandlers) {
  if (!element) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let lastTapTime = 0;
  let longPressTimer: NodeJS.Timeout | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();

    if (handlers.onLongPress) {
      longPressTimer = setTimeout(() => {
        haptics.medium();
        handlers.onLongPress?.(e);
      }, LONG_PRESS_DURATION);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    const touch = e.changedTouches[0];
    if (!touch) return;
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const touchEndTime = Date.now();

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const duration = touchEndTime - touchStartTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / duration;

    if (distance < 10 && duration < 200) {
      const timeSinceLastTap = touchEndTime - lastTapTime;
      
      if (timeSinceLastTap < DOUBLE_TAP_DELAY && handlers.onDoubleTap) {
        haptics.light();
        handlers.onDoubleTap(e);
        lastTapTime = 0;
      } else {
        if (handlers.onTap) {
          haptics.selection();
          handlers.onTap(e);
        }
        lastTapTime = touchEndTime;
      }
      return;
    }

    if (distance > SWIPE_THRESHOLD && velocity > SWIPE_VELOCITY_THRESHOLD && handlers.onSwipe) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      let direction: SwipeGesture['direction'];
      if (absX > absY) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      haptics.light();
      handlers.onSwipe({
        direction,
        distance,
        velocity,
        duration,
      });
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    if (longPressTimer) clearTimeout(longPressTimer);
  };
}

export function preventZoom() {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  });
}

export const touch = {
  useTouchGestures,
  preventZoom,
};

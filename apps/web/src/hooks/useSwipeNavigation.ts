'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeState {
  direction: SwipeDirection | null;
  distance: number;
  velocity: number;
  isActive: boolean;
}

interface UseSwipeNavigationOptions {
  /** Minimum distance in px to register a swipe (default 60) */
  distanceThreshold?: number;
  /** Minimum velocity in px/ms to register a swipe (default 0.4) */
  velocityThreshold?: number;
  /** Only trigger when swipe starts from screen edge (within this many px) */
  edgeWidth?: number;
  /** Element ref to attach listeners to (defaults to window) */
  elementRef?: React.RefObject<HTMLElement | null>;
  /** Callback on swipe complete */
  onSwipe?: (direction: SwipeDirection, distance: number, velocity: number) => void;
  /** Whether the hook is enabled (default true) */
  enabled?: boolean;
}

export function useSwipeNavigation({
  distanceThreshold = 60,
  velocityThreshold = 0.4,
  edgeWidth,
  elementRef,
  onSwipe,
  enabled = true,
}: UseSwipeNavigationOptions = {}) {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    direction: null,
    distance: 0,
    velocity: 0,
    isActive: false,
  });

  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const activeRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      // Cancel on multi-touch
      if (e.touches.length > 1) {
        startRef.current = null;
        activeRef.current = false;
        setSwipeState((s) => (s.isActive ? { ...s, isActive: false } : s));
        return;
      }

      const touch = e.touches[0]!;

      // Edge detection
      if (edgeWidth !== undefined) {
        const x = touch.clientX;
        const screenW = window.innerWidth;
        if (x > edgeWidth && x < screenW - edgeWidth) {
          startRef.current = null;
          return;
        }
      }

      startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      activeRef.current = true;
      setSwipeState({ direction: null, distance: 0, velocity: 0, isActive: true });
    },
    [enabled, edgeWidth]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!startRef.current || !activeRef.current) return;
      if (e.touches.length > 1) {
        activeRef.current = false;
        setSwipeState((s) => (s.isActive ? { ...s, isActive: false } : s));
        return;
      }

      const touch = e.touches[0]!;
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let direction: SwipeDirection;
      let distance: number;

      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
        distance = absDx;
      } else {
        direction = dy > 0 ? 'down' : 'up';
        distance = absDy;
      }

      const elapsed = Date.now() - startRef.current.time;
      const velocity = elapsed > 0 ? distance / elapsed : 0;

      setSwipeState({ direction, distance, velocity, isActive: true });
    },
    []
  );

  const handleTouchEnd = useCallback(
    () => {
      if (!startRef.current || !activeRef.current) {
        startRef.current = null;
        activeRef.current = false;
        return;
      }

      const state = swipeState;
      startRef.current = null;
      activeRef.current = false;

      if (
        state.direction &&
        state.distance >= distanceThreshold &&
        state.velocity >= velocityThreshold
      ) {
        onSwipe?.(state.direction, state.distance, state.velocity);
      }

      setSwipeState({ direction: null, distance: 0, velocity: 0, isActive: false });
    },
    [swipeState, distanceThreshold, velocityThreshold, onSwipe]
  );

  useEffect(() => {
    if (!enabled) return;

    const el = elementRef?.current ?? window;
    const opts: AddEventListenerOptions = { passive: true };

    el.addEventListener('touchstart', handleTouchStart as EventListener, opts);
    el.addEventListener('touchmove', handleTouchMove as EventListener, opts);
    el.addEventListener('touchend', handleTouchEnd as EventListener, opts);
    el.addEventListener('touchcancel', handleTouchEnd as EventListener, opts);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart as EventListener);
      el.removeEventListener('touchmove', handleTouchMove as EventListener);
      el.removeEventListener('touchend', handleTouchEnd as EventListener);
      el.removeEventListener('touchcancel', handleTouchEnd as EventListener);
    };
  }, [enabled, elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return swipeState;
}

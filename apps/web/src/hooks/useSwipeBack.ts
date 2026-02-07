'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationStore } from '@/lib/stores/navigation';
import { haptics } from '@/lib/pwa/haptics';

const EDGE_WIDTH = 20; // px from left edge
const THRESHOLD = 80; // px to trigger back
const VELOCITY_THRESHOLD = 0.5; // px/ms

interface SwipeBackState {
  isActive: boolean;
  progress: number; // 0-1
}

/**
 * Detects left-edge swipe right gesture and triggers router.back().
 * Returns state for visual indicator rendering.
 */
export function useSwipeBack(enabled = true): SwipeBackState {
  const router = useRouter();
  const setDirection = useNavigationStore((s) => s.setDirection);
  const [state, setState] = useState<SwipeBackState>({ isActive: false, progress: 0 });

  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const isEdgeSwipe = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch || touch.clientX > EDGE_WIDTH) return;
      isEdgeSwipe.current = true;
      touchStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    },
    [enabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isEdgeSwipe.current || !touchStart.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStart.current.x;
      const dy = Math.abs(touch.clientY - touchStart.current.y);

      // Cancel if vertical movement dominates
      if (dy > dx * 1.5) {
        isEdgeSwipe.current = false;
        setState({ isActive: false, progress: 0 });
        return;
      }

      if (dx > 10) {
        setState({ isActive: true, progress: Math.min(dx / THRESHOLD, 1) });
      }
    },
    []
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isEdgeSwipe.current || !touchStart.current) {
        isEdgeSwipe.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStart.current.x;
      const dt = Date.now() - touchStart.current.t;
      const velocity = dx / dt;

      if (dx > THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        haptics.light();
        setDirection('pop');
        router.back();
      }

      isEdgeSwipe.current = false;
      touchStart.current = null;
      setState({ isActive: false, progress: 0 });
    },
    [router, setDirection]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return state;
}

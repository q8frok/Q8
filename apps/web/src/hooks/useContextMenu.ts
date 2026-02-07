'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { haptics } from '@/lib/pwa/haptics';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

interface UseContextMenuReturn {
  state: ContextMenuState;
  close: () => void;
  handlers: {
    onContextMenu: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchMove: () => void;
  };
}

const LONG_PRESS_DURATION = 500;

/**
 * Combines long-press (mobile) + right-click (desktop) to open a context menu.
 */
export function useContextMenu(): UseContextMenuReturn {
  const [state, setState] = useState<ContextMenuState>({ isOpen: false, x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);

  const open = useCallback((x: number, y: number) => {
    haptics.medium();
    setState({ isOpen: true, x, y });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, x: 0, y: 0 });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Close on scroll or outside click
  useEffect(() => {
    if (!state.isOpen) return;
    const handleClose = () => close();
    window.addEventListener('scroll', handleClose, { passive: true });
    return () => window.removeEventListener('scroll', handleClose);
  }, [state.isOpen, close]);

  const handlers = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      open(e.clientX, e.clientY);
    },
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchPosRef.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        if (touchPosRef.current) {
          open(touchPosRef.current.x, touchPosRef.current.y);
        }
      }, LONG_PRESS_DURATION);
    },
    onTouchEnd: () => {
      clearTimer();
      touchPosRef.current = null;
    },
    onTouchMove: () => {
      clearTimer();
      touchPosRef.current = null;
    },
  };

  return { state, close, handlers };
}

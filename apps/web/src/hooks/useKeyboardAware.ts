'use client';

import { useState, useEffect, useCallback } from 'react';

interface KeyboardState {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
}

/**
 * Tracks virtual keyboard height using VisualViewport API.
 * Returns keyboard height for smooth input positioning.
 */
export function useKeyboardAware(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    keyboardHeight: 0,
    isKeyboardVisible: false,
  });

  const update = useCallback(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    // Keyboard height = difference between window height and visual viewport height
    const kbHeight = Math.max(0, window.innerHeight - vv.height);
    setState({
      keyboardHeight: kbHeight,
      isKeyboardVisible: kbHeight > 100, // threshold to avoid false positives from address bar
    });
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [update]);

  return state;
}

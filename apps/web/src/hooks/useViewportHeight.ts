'use client';

import { useState, useEffect } from 'react';

/**
 * useViewportHeight
 *
 * Returns the visual viewport height, accounting for the iOS virtual keyboard.
 * Falls back to window.innerHeight when VisualViewport API is unavailable.
 *
 * Sets a CSS custom property --vh on :root so CSS can use it:
 *   height: calc(var(--vh, 1vh) * 100);
 */
export function useViewportHeight() {
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  useEffect(() => {
    const viewport = window.visualViewport;

    function update() {
      const h = viewport?.height ?? window.innerHeight;
      setHeight(h);
      document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
    }

    update();

    if (viewport) {
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
      } else {
        window.removeEventListener('resize', update);
      }
    };
  }, []);

  return height;
}

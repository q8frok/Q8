'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface ScrollCollapseState {
  scrollY: number;
  /** 0 = fully expanded, 1 = fully collapsed */
  progress: number;
  isCollapsed: boolean;
}

/**
 * Tracks scroll position and returns collapse progress for header animations.
 * Maps scrollY [0, threshold] to progress [0, 1].
 */
export function useScrollCollapse(threshold = 80): ScrollCollapseState & {
  scrollRef: React.RefObject<HTMLDivElement | null>;
} {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ScrollCollapseState>({
    scrollY: 0,
    progress: 0,
    isCollapsed: false,
  });

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    const progress = Math.min(y / threshold, 1);
    setState({
      scrollY: y,
      progress,
      isCollapsed: progress > 0.5,
    });
  }, [threshold]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return { ...state, scrollRef };
}

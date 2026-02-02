'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScrollFadeProps {
  /** Scroll direction to apply fade */
  direction?: 'horizontal' | 'vertical';
  /** Fade size in px (default 32) */
  fadeSize?: number;
  children: ReactNode;
  className?: string;
}

/**
 * Gradient fade at edges of scrollable widget content.
 * CSS-only mask-image for performance. Auto-hides when fully scrolled to edge.
 */
export function ScrollFade({
  direction = 'vertical',
  fadeSize = 32,
  children,
  className,
}: ScrollFadeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const checkScroll = () => {
      if (direction === 'horizontal') {
        setCanScrollStart(el.scrollLeft > 2);
        setCanScrollEnd(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
      } else {
        setCanScrollStart(el.scrollTop > 2);
        setCanScrollEnd(el.scrollTop < el.scrollHeight - el.clientHeight - 2);
      }
    };

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });

    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [direction]);

  // Build mask-image based on scroll position
  const getMaskImage = () => {
    const isH = direction === 'horizontal';
    const dir = isH ? 'to right' : 'to bottom';
    const startFade = canScrollStart
      ? `transparent, black ${fadeSize}px`
      : 'black, black';
    const endFade = canScrollEnd
      ? `black calc(100% - ${fadeSize}px), transparent`
      : 'black, black';

    return `linear-gradient(${dir}, ${startFade}, ${endFade})`;
  };

  return (
    <div
      ref={scrollRef}
      className={cn(
        direction === 'horizontal'
          ? 'overflow-x-auto overflow-y-hidden scrollbar-thin'
          : 'overflow-y-auto overflow-x-hidden scrollbar-thin',
        className
      )}
      style={{
        WebkitMaskImage: getMaskImage(),
        maskImage: getMaskImage(),
      }}
    >
      {children}
    </div>
  );
}

ScrollFade.displayName = 'ScrollFade';

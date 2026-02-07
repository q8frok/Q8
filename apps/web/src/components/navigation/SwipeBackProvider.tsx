'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { usePathname } from 'next/navigation';

interface SwipeBackProviderProps {
  children: ReactNode;
}

/**
 * Wraps page content and translates proportionally during swipe-back gesture.
 * Shows a chevron indicator at the left edge.
 */
export function SwipeBackProvider({ children }: SwipeBackProviderProps) {
  const pathname = usePathname();
  const isSubPage = pathname !== '/';
  const { isActive, progress } = useSwipeBack(isSubPage);

  return (
    <div className="relative">
      {/* Back swipe edge indicator */}
      {isActive && (
        <motion.div
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-8 h-16 rounded-r-xl"
          style={{
            backgroundColor: `oklch(65% 0.2 260 / ${progress * 0.3})`,
            opacity: progress,
          }}
          initial={false}
          animate={{ x: progress * 12 }}
        >
          <svg
            width="12"
            height="20"
            viewBox="0 0 12 20"
            fill="none"
            style={{ opacity: progress }}
          >
            <path
              d="M10 2L2 10L10 18"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      )}

      {/* Page content shifts right during swipe */}
      <div
        style={{
          transform: isActive ? `translateX(${progress * 60}px)` : 'none',
          transition: isActive ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

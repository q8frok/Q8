'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { haptics } from '@/lib/pwa/haptics';
import { springBouncy } from '@/lib/animations/springs';

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  /** Pull distance to trigger refresh (default 80) */
  threshold?: number;
  /** Whether refresh is currently in progress */
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Pull-to-refresh wrapper.
 * Only activates when scrolled to top (scrollTop === 0).
 * Shows progress arc indicator while pulling.
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  isRefreshing = false,
  className,
}: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const thresholdCrossedRef = useRef(false);

  const progress = Math.min(pullDistance / threshold, 1);
  const isActive = refreshing || isRefreshing;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || isActive) return;

    // Only activate when scrolled to top
    if (container.scrollTop > 0) return;

    const touch = e.touches[0];
    if (touch) {
      startYRef.current = touch.clientY;
      pullingRef.current = true;
      thresholdCrossedRef.current = false;
    }
  }, [isActive]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || isActive) return;

    const touch = e.touches[0];
    if (!touch) return;

    const dy = touch.clientY - startYRef.current;

    if (dy > 0) {
      // Apply resistance (pull distance = actual distance * 0.5)
      const distance = dy * 0.5;
      setPullDistance(distance);
      setPulling(true);

      // Haptic when crossing threshold
      if (distance >= threshold && !thresholdCrossedRef.current) {
        thresholdCrossedRef.current = true;
        haptics.medium();
      } else if (distance < threshold && thresholdCrossedRef.current) {
        thresholdCrossedRef.current = false;
      }
    }
  }, [threshold, isActive]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= threshold && !isActive) {
      setRefreshing(true);
      haptics.impact();
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }

    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, threshold, isActive, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="flex items-center justify-center overflow-hidden"
        animate={{
          height: pulling || isActive ? Math.max(pullDistance, isActive ? 48 : 0) : 0,
          opacity: pulling || isActive ? 1 : 0,
        }}
        transition={springBouncy}
      >
        <motion.div
          animate={{
            rotate: isActive ? 360 : progress * 270,
          }}
          transition={isActive ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
        >
          <RefreshCw
            className="h-5 w-5"
            style={{
              color: progress >= 1 ? 'var(--color-neon-primary)' : 'var(--text-muted)',
            }}
          />
        </motion.div>
      </motion.div>

      {children}
    </div>
  );
}

PullToRefresh.displayName = 'PullToRefresh';

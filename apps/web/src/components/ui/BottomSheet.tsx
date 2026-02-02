'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/pwa/haptics';

export type SnapPoint = 'closed' | 'peek' | 'half' | 'full';

interface BottomSheetProps {
  /** Current snap state */
  snap: SnapPoint;
  /** Called when snap state changes */
  onSnapChange: (snap: SnapPoint) => void;
  /** Peek height in px (default 120) */
  peekHeight?: number;
  /** Content to render in peek state */
  peekContent?: ReactNode;
  /** Main sheet content */
  children: ReactNode;
  /** Additional class for the sheet container */
  className?: string;
  /** Whether to show backdrop at half/full states */
  showBackdrop?: boolean;
  /** Z-index (default 50) */
  zIndex?: number;
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };
const DISMISS_VELOCITY = 400; // px/s downward = close

/**
 * Draggable bottom sheet with 3 snap points.
 * Uses portal + scroll-lock. Safe-area-bottom padding built in.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  peekHeight = 120,
  peekContent,
  children,
  className,
  showBackdrop = true,
  zIndex = 50,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastSnapRef = useRef<SnapPoint>(snap);
  const dragY = useMotionValue(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when sheet is half or full
  useEffect(() => {
    if (snap === 'half' || snap === 'full') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [snap]);

  // Calculate snap positions as translateY from bottom
  // 0 = fully open (top of screen + safe area)
  const getSnapY = useCallback(
    (s: SnapPoint): number => {
      if (typeof window === 'undefined') return 0;
      const vh = window.innerHeight;
      switch (s) {
        case 'closed':
          return vh;
        case 'peek':
          return vh - peekHeight;
        case 'half':
          return vh * 0.5;
        case 'full':
          // Leave space for safe-area-top (approx 59px on iPhone with Dynamic Island)
          return 0;
        default:
          return vh;
      }
    },
    [peekHeight]
  );

  const snapToClosest = useCallback(
    (currentY: number, velocityY: number) => {
      const vh = window.innerHeight;

      // Fast downward swipe = dismiss
      if (velocityY > DISMISS_VELOCITY) {
        if (snap === 'full') {
          onSnapChange('half');
          haptics.light();
          return;
        }
        if (snap === 'half') {
          onSnapChange('peek');
          haptics.light();
          return;
        }
        onSnapChange('closed');
        haptics.medium();
        return;
      }

      // Fast upward swipe = expand
      if (velocityY < -DISMISS_VELOCITY) {
        if (snap === 'peek') {
          onSnapChange('half');
          haptics.light();
          return;
        }
        if (snap === 'half') {
          onSnapChange('full');
          haptics.light();
          return;
        }
        return;
      }

      // Snap to closest point based on position
      const points: { snap: SnapPoint; y: number }[] = [
        { snap: 'closed', y: vh },
        { snap: 'peek', y: vh - peekHeight },
        { snap: 'half', y: vh * 0.5 },
        { snap: 'full', y: 0 },
      ];

      let closest = points[0]!;
      let minDist = Math.abs(currentY - closest.y);

      for (const p of points) {
        const dist = Math.abs(currentY - p.y);
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      }

      if (closest.snap !== snap) {
        if (closest.snap === 'closed') {
          haptics.medium();
        } else {
          haptics.light();
        }
      }

      onSnapChange(closest.snap);
    },
    [snap, onSnapChange, peekHeight]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const currentY = getSnapY(snap) + info.offset.y;
      snapToClosest(currentY, info.velocity.y);
    },
    [snap, getSnapY, snapToClosest]
  );

  // Trigger selection haptic while dragging
  const handleDrag = useCallback(() => {
    // Haptic on drag is handled sparingly via snap detection
  }, []);

  // Track snap changes for haptic on snap
  useEffect(() => {
    if (lastSnapRef.current !== snap && snap !== 'closed') {
      // Haptic already fired in snapToClosest
    }
    lastSnapRef.current = snap;
  }, [snap]);

  const backdropOpacity = useTransform(
    dragY,
    [0, 1],
    [0, 1]
  );

  const isVisible = snap !== 'closed';

  if (!mounted) return null;

  const sheetContent = (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          {showBackdrop && (snap === 'half' || snap === 'full') && (
            <motion.div
              key="bottom-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: snap === 'full' ? 0.6 : 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              style={{ zIndex: zIndex - 1 }}
              onClick={() => {
                haptics.light();
                onSnapChange('peek');
              }}
            />
          )}

          {/* Sheet */}
          <motion.div
            key="bottom-sheet"
            ref={sheetRef}
            initial={{ y: window.innerHeight }}
            animate={{ y: getSnapY(snap) }}
            exit={{ y: window.innerHeight }}
            transition={SPRING}
            drag="y"
            dragConstraints={{ top: 0, bottom: window.innerHeight }}
            dragElastic={0.1}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed inset-x-0 top-0 flex flex-col bg-[var(--surface-2)] border-t border-[var(--border-subtle)] rounded-t-2xl shadow-lg',
              'lg:hidden',
              className
            )}
            style={{
              height: '100vh',
              zIndex,
              paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Peek content (always visible when sheet is open) */}
            {peekContent && snap === 'peek' && (
              <div className="px-4 pb-2">
                {peekContent}
              </div>
            )}

            {/* Main content (visible at half/full) */}
            {(snap === 'half' || snap === 'full') && (
              <div
                ref={contentRef}
                className="flex-1 overflow-hidden"
                style={{
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
              >
                {children}
              </div>
            )}

            {/* Safe area bottom spacer for peek */}
            {snap === 'peek' && (
              <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(sheetContent, document.body);
}

BottomSheet.displayName = 'BottomSheet';

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * BentoGrid v2.0
 *
 * Responsive dashboard grid with Q8 Design System spacing.
 * - Desktop: 16px gap
 * - Tablet: 12px gap
 * - Mobile: 8px gap (single column)
 */
export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(160px,auto)]',
        // Responsive gap per design spec
        'gap-2 sm:gap-3 md:gap-4',
        // Responsive padding with bottom safe area
        'p-2 sm:p-3 md:p-4 safe-area-bottom',
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoItemProps {
  children: React.ReactNode;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
}

/**
 * BentoItem - Generic grid item container
 *
 * Use WidgetWrapper for actual widgets.
 * This is for raw grid placement without widget chrome.
 */
export function BentoItem({
  children,
  colSpan = 1,
  rowSpan = 1,
  className,
}: BentoItemProps) {
  // Map colSpan to Tailwind classes
  // Mobile (<440px): single column, all full width
  // Phablet (sm 440px+): 2-col grid, colSpan 1=1col, colSpan 2+=full width
  // Tablet (md 768px+): 4-col grid, colSpan as specified
  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 sm:col-span-2 md:col-span-2',
    3: 'col-span-1 sm:col-span-2 md:col-span-3',
    4: 'col-span-1 sm:col-span-2 md:col-span-4',
  };

  // Map rowSpan to Tailwind classes
  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4',
  };

  return (
    <motion.div
      layout
      className={cn(
        'surface-matte relative overflow-hidden w-full',
        colSpanClasses[colSpan],
        rowSpanClasses[rowSpan],
        className
      )}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

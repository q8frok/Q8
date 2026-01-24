'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { CalendarBadgeProps } from '../types';

/**
 * CalendarBadge - Calendar color indicator with optional name
 *
 * Small badge showing calendar color for visual identification.
 */
export const CalendarBadge = memo(function CalendarBadge({
  calendar,
  showName = true,
  size = 'md',
}: CalendarBadgeProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const textSizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn('rounded-sm flex-shrink-0', sizeClasses[size])}
        style={{ backgroundColor: calendar.backgroundColor }}
      />
      {showName && (
        <span
          className={cn(
            'truncate text-text-secondary',
            textSizeClasses[size],
            calendar.primary && 'font-medium'
          )}
        >
          {calendar.summary}
        </span>
      )}
    </div>
  );
});

CalendarBadge.displayName = 'CalendarBadge';

export default CalendarBadge;

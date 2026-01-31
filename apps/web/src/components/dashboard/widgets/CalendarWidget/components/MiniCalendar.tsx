'use client';

import { memo, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DAY_NAMES_MIN, MONTH_NAMES_SHORT, toLocalDateStr, isoToLocalDateStr } from '../constants';
import type { MiniCalendarProps } from '../types';

/**
 * MiniCalendar - Small month calendar for date selection
 *
 * Compact calendar picker with event indicators.
 */
export const MiniCalendar = memo(function MiniCalendar({
  selectedDate,
  onDateSelect,
  events = [],
  highlightToday = true,
  showNavigation = true,
  className,
}: MiniCalendarProps) {
  // Get the current month being displayed
  const displayMonth = useMemo(() => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }, [selectedDate]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startPadding = firstDay.getDay(); // 0 = Sunday

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Build array of days
    const days: Array<{ date: Date; isCurrentMonth: boolean; hasEvents: boolean }> = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false, hasEvents: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = toLocalDateStr(date);
      const hasEvents = events.some((e) => isoToLocalDateStr(e.start_time) === dateStr);
      days.push({ date, isCurrentMonth: true, hasEvents });
    }

    // Next month padding to complete grid (6 rows max)
    const remaining = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, hasEvents: false });
    }

    return days;
  }, [displayMonth, events]);

  const goToPreviousMonth = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateSelect(newDate);
  }, [selectedDate, onDateSelect]);

  const goToNextMonth = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateSelect(newDate);
  }, [selectedDate, onDateSelect]);

  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const selectedStr = toLocalDateStr(selectedDate);

  return (
    <div className={cn('w-full', className)}>
      {/* Header with navigation */}
      {showNavigation && (
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goToPreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {MONTH_NAMES_SHORT[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goToNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Day names header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_NAMES_MIN.map((day, i) => (
          <div
            key={i}
            className="text-center text-[10px] text-text-muted font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map(({ date, isCurrentMonth, hasEvents }, i) => {
          const dateStr = toLocalDateStr(date);
          const isToday = highlightToday && dateStr === todayStr;
          const isSelected = dateStr === selectedStr;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateSelect(date)}
              className={cn(
                'relative aspect-square flex items-center justify-center text-xs rounded transition-colors',
                'hover:bg-surface-4',
                !isCurrentMonth && 'text-text-muted/50',
                isCurrentMonth && 'text-text-secondary',
                isToday && 'font-bold text-neon-primary',
                isSelected && 'bg-neon-primary/20 text-neon-primary ring-1 ring-neon-primary/50'
              )}
            >
              {date.getDate()}
              {hasEvents && (
                <span
                  className={cn(
                    'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                    isSelected ? 'bg-neon-primary' : 'bg-neon-accent'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

MiniCalendar.displayName = 'MiniCalendar';

export default MiniCalendar;

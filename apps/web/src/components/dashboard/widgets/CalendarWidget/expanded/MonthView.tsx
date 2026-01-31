'use client';

import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAY_NAMES_SHORT, toLocalDateStr, isoToLocalDateStr } from '../constants';
import type { MonthViewProps, CalendarEventDisplay } from '../types';

/**
 * DayEventsPopover - Shows all events for a day when "+n more" is clicked
 */
function DayEventsPopover({
  date,
  events,
  onEventClick,
  onClose,
}: {
  date: Date;
  events: CalendarEventDisplay[];
  onEventClick: (event: CalendarEventDisplay) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      className={cn(
        'absolute z-30 left-0 right-0 mt-1',
        'bg-surface-2 border border-border-subtle rounded-lg shadow-xl',
        'p-2 min-w-[200px] max-h-[300px] overflow-y-auto'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-text-primary">
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-0.5">
        {events.map((event) => (
          <button
            key={event.id}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(event);
              onClose();
            }}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded text-xs truncate',
              'hover:opacity-80 transition-opacity'
            )}
            style={{
              backgroundColor: event.calendarColor + '30',
              color: event.calendarColor,
            }}
          >
            {!event.all_day && (
              <span className="font-medium mr-1">
                {event.startDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            )}
            {event.title}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * MonthView - Full month calendar grid
 *
 * Shows events positioned on calendar days.
 */
export const MonthView = memo(function MonthView({
  currentDate,
  events,
  selectedDate,
  onDateSelect,
  onEventClick,
  onCreateEvent,
}: MonthViewProps) {
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  // Generate calendar grid
  const calendarWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startPadding = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const weeks: Array<
      Array<{
        date: Date;
        isCurrentMonth: boolean;
        events: CalendarEventDisplay[];
      }>
    > = [];

    let currentWeek: typeof weeks[0] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      const dateStr = toLocalDateStr(date);
      const dayEvents = events.filter(
        (e) => isoToLocalDateStr(e.start_time) === dateStr
      );
      currentWeek.push({ date, isCurrentMonth: false, events: dayEvents });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const date = new Date(year, month, day);
      const dateStr = toLocalDateStr(date);
      const dayEvents = events.filter(
        (e) => isoToLocalDateStr(e.start_time) === dateStr
      );
      currentWeek.push({ date, isCurrentMonth: true, events: dayEvents });
    }

    // Next month padding
    let nextMonthDay = 1;
    while (currentWeek.length < 7 || weeks.length < 5) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const date = new Date(year, month + 1, nextMonthDay++);
      const dateStr = toLocalDateStr(date);
      const dayEvents = events.filter(
        (e) => isoToLocalDateStr(e.start_time) === dateStr
      );
      currentWeek.push({ date, isCurrentMonth: false, events: dayEvents });
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [currentDate, events]);

  const today = toLocalDateStr(new Date());
  const selectedStr = selectedDate ? toLocalDateStr(selectedDate) : undefined;

  return (
    <div className="h-full flex flex-col">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {DAY_NAMES_SHORT.map((day) => (
          <div
            key={day}
            className="px-2 py-3 text-center text-xs font-medium text-text-muted uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-rows-5">
        {calendarWeeks.slice(0, 5).map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-border-subtle last:border-b-0">
            {week.map((day, dayIndex) => {
              const dateStr = toLocalDateStr(day.date);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedStr;
              const isExpanded = expandedDayKey === dateStr;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    'min-h-[100px] p-1 border-r border-border-subtle last:border-r-0 relative',
                    'hover:bg-surface-4/50 cursor-pointer transition-colors',
                    !day.isCurrentMonth && 'bg-surface-2/30'
                  )}
                  onClick={() => onDateSelect(day.date)}
                  onDoubleClick={() => onCreateEvent(day.date)}
                >
                  {/* Day Number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm',
                        !day.isCurrentMonth && 'text-text-muted',
                        day.isCurrentMonth && 'text-text-secondary',
                        isToday && 'bg-neon-primary text-white font-bold',
                        isSelected && !isToday && 'bg-neon-primary/20 text-neon-primary'
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {day.events.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className={cn(
                          'w-full text-left px-1.5 py-0.5 rounded text-xs truncate',
                          'hover:opacity-80 transition-opacity'
                        )}
                        style={{
                          backgroundColor: event.calendarColor + '30',
                          color: event.calendarColor,
                        }}
                      >
                        {!event.all_day && (
                          <span className="font-medium mr-1">
                            {event.startDate.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        {event.title}
                      </button>
                    ))}
                    {day.events.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDayKey(isExpanded ? null : dateStr);
                        }}
                        className="text-xs text-neon-primary hover:text-neon-accent px-1.5 cursor-pointer transition-colors font-medium"
                      >
                        +{day.events.length - 3} more
                      </button>
                    )}
                  </div>

                  {/* Day Events Popover */}
                  <AnimatePresence>
                    {isExpanded && day.events.length > 3 && (
                      <DayEventsPopover
                        date={day.date}
                        events={day.events}
                        onEventClick={onEventClick}
                        onClose={() => setExpandedDayKey(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

MonthView.displayName = 'MonthView';

export default MonthView;

'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DAY_NAMES_SHORT } from '../constants';
import type { MonthViewProps, CalendarEventDisplay } from '../types';

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
    let dayCount = 0;

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayEvents = events.filter(
        (e) => e.start_time.slice(0, 10) === dateStr
      );
      currentWeek.push({ date, isCurrentMonth: false, events: dayEvents });
      dayCount++;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const date = new Date(year, month, day);
      const dateStr = date.toISOString().slice(0, 10);
      const dayEvents = events.filter(
        (e) => e.start_time.slice(0, 10) === dateStr
      );
      currentWeek.push({ date, isCurrentMonth: true, events: dayEvents });
      dayCount++;
    }

    // Next month padding
    let nextMonthDay = 1;
    while (currentWeek.length < 7 || weeks.length < 5) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const date = new Date(year, month + 1, nextMonthDay++);
      const dateStr = date.toISOString().slice(0, 10);
      const dayEvents = events.filter(
        (e) => e.start_time.slice(0, 10) === dateStr
      );
      currentWeek.push({ date, isCurrentMonth: false, events: dayEvents });
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [currentDate, events]);

  const today = new Date().toISOString().slice(0, 10);
  const selectedStr = selectedDate?.toISOString().slice(0, 10);

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
              const dateStr = day.date.toISOString().slice(0, 10);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedStr;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    'min-h-[100px] p-1 border-r border-border-subtle last:border-r-0',
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
                      <div className="text-xs text-text-muted px-1.5">
                        +{day.events.length - 3} more
                      </div>
                    )}
                  </div>
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

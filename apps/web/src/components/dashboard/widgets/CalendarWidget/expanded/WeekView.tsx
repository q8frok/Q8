'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DAY_NAMES_SHORT, HOUR_SLOTS, VIEW_CONFIG } from '../constants';
import type { WeekViewProps, CalendarEventDisplay } from '../types';

/**
 * WeekView - 7-day week calendar with hourly timeline
 *
 * Shows events positioned by time on a weekly grid.
 */
export const WeekView = memo(function WeekView({
  currentDate,
  events,
  selectedDate,
  onDateSelect,
  onEventClick,
  onCreateEvent,
}: WeekViewProps) {
  // Get week days
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Array<{
      date: Date;
      dateStr: string;
      events: CalendarEventDisplay[];
      allDayEvents: CalendarEventDisplay[];
    }> = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);

      const dayEvents = events.filter(
        (e) => e.start_time.slice(0, 10) === dateStr && !e.all_day
      );
      const allDayEvents = events.filter(
        (e) => e.start_time.slice(0, 10) === dateStr && e.all_day
      );

      days.push({ date, dateStr, events: dayEvents, allDayEvents });
    }

    return days;
  }, [currentDate, events]);

  const today = new Date().toISOString().slice(0, 10);

  // Calculate event position and height
  const getEventStyle = (event: CalendarEventDisplay) => {
    const startHour =
      event.startDate.getHours() + event.startDate.getMinutes() / 60;
    const durationHours = event.durationMinutes / 60;

    return {
      top: `${startHour * VIEW_CONFIG.HOUR_HEIGHT}px`,
      height: `${Math.max(durationHours * VIEW_CONFIG.HOUR_HEIGHT, VIEW_CONFIG.MIN_EVENT_HEIGHT)}px`,
    };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with day names */}
      <div className="flex border-b border-border-subtle">
        <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
        {weekDays.map(({ date, dateStr }) => {
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className="flex-1 text-center py-2 border-l border-border-subtle"
            >
              <div className="text-xs text-text-muted uppercase">
                {DAY_NAMES_SHORT[date.getDay()]}
              </div>
              <div
                className={cn(
                  'text-lg font-semibold',
                  isToday ? 'text-neon-primary' : 'text-text-primary'
                )}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      {weekDays.some((d) => d.allDayEvents.length > 0) && (
        <div className="flex border-b border-border-subtle">
          <div className="w-16 flex-shrink-0 text-xs text-text-muted py-1 px-2">
            All day
          </div>
          {weekDays.map(({ dateStr, allDayEvents }) => (
            <div
              key={dateStr}
              className="flex-1 border-l border-border-subtle p-1 min-h-[40px]"
            >
              {allDayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={cn(
                    'w-full text-left px-1.5 py-0.5 rounded text-xs truncate mb-0.5',
                    'hover:opacity-80 transition-opacity'
                  )}
                  style={{
                    backgroundColor: event.calendarColor + '30',
                    color: event.calendarColor,
                  }}
                >
                  {event.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative">
          {/* Time column */}
          <div className="w-16 flex-shrink-0">
            {HOUR_SLOTS.map((hour) => (
              <div
                key={hour}
                className="text-xs text-text-muted text-right pr-2"
                style={{ height: VIEW_CONFIG.HOUR_HEIGHT }}
              >
                {hour === 0
                  ? '12 AM'
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? '12 PM'
                  : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(({ date, dateStr, events: dayEvents }) => {
            const isToday = dateStr === today;

            return (
              <div
                key={dateStr}
                className={cn(
                  'flex-1 relative border-l border-border-subtle',
                  isToday && 'bg-neon-primary/5'
                )}
              >
                {/* Hour grid lines */}
                {HOUR_SLOTS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border-subtle/50 hover:bg-surface-4/30 cursor-pointer"
                    style={{ height: VIEW_CONFIG.HOUR_HEIGHT }}
                    onClick={() => onCreateEvent(date, hour)}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={cn(
                      'absolute left-1 right-1 rounded px-1.5 py-0.5',
                      'text-xs text-left overflow-hidden',
                      'hover:opacity-80 transition-opacity'
                    )}
                    style={{
                      ...getEventStyle(event),
                      backgroundColor: event.calendarColor + '30',
                      color: event.calendarColor,
                      borderLeft: `3px solid ${event.calendarColor}`,
                    }}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-[10px] opacity-80">
                      {event.formattedTime}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

WeekView.displayName = 'WeekView';

export default WeekView;

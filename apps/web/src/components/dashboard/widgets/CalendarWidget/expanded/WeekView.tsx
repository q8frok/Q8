'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DAY_NAMES_SHORT, HOUR_SLOTS, VIEW_CONFIG, toLocalDateStr, isoToLocalDateStr } from '../constants';
import type { WeekViewProps, CalendarEventDisplay } from '../types';

interface LayoutEvent extends CalendarEventDisplay {
  column: number;
  totalColumns: number;
}

/**
 * Calculate column layout for overlapping events within a single day column.
 */
function layoutOverlappingEvents(events: CalendarEventDisplay[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  const firstEvent = sorted[0]!;
  const groups: CalendarEventDisplay[][] = [];
  let currentGroup: CalendarEventDisplay[] = [firstEvent];
  let groupEnd = firstEvent.endDate.getTime();

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i]!;
    if (event.startDate.getTime() < groupEnd) {
      currentGroup.push(event);
      groupEnd = Math.max(groupEnd, event.endDate.getTime());
    } else {
      groups.push(currentGroup);
      currentGroup = [event];
      groupEnd = event.endDate.getTime();
    }
  }
  groups.push(currentGroup);

  const result: LayoutEvent[] = [];

  for (const group of groups) {
    const columns: CalendarEventDisplay[][] = [];

    for (const event of group) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const colArr = columns[col]!;
        const lastInCol = colArr[colArr.length - 1];
        if (lastInCol && lastInCol.endDate.getTime() <= event.startDate.getTime()) {
          colArr.push(event);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([event]);
      }
    }

    const totalColumns = columns.length;
    for (let col = 0; col < columns.length; col++) {
      for (const event of columns[col]!) {
        result.push({ ...event, column: col, totalColumns });
      }
    }
  }

  return result;
}

/**
 * WeekView - 7-day week calendar with hourly timeline
 *
 * Shows events positioned by time on a weekly grid.
 * Overlapping events are displayed side-by-side in columns.
 */
export const WeekView = memo(function WeekView({
  currentDate,
  events,
  selectedDate,
  onDateSelect,
  onEventClick,
  onCreateEvent,
}: WeekViewProps) {
  // Get week days with layout-computed events
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Array<{
      date: Date;
      dateStr: string;
      layoutEvents: LayoutEvent[];
      allDayEvents: CalendarEventDisplay[];
    }> = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = toLocalDateStr(date);

      const dayTimedEvents = events.filter(
        (e) => isoToLocalDateStr(e.start_time) === dateStr && !e.all_day
      );
      const allDayEvents = events.filter(
        (e) => isoToLocalDateStr(e.start_time) === dateStr && e.all_day
      );

      days.push({
        date,
        dateStr,
        layoutEvents: layoutOverlappingEvents(dayTimedEvents),
        allDayEvents,
      });
    }

    return days;
  }, [currentDate, events]);

  const today = toLocalDateStr(new Date());

  // Calculate event position and height with column layout
  const getEventStyle = (event: LayoutEvent) => {
    const startHour =
      event.startDate.getHours() + event.startDate.getMinutes() / 60;
    const durationHours = event.durationMinutes / 60;
    const widthPercent = 100 / event.totalColumns;
    const leftPercent = event.column * widthPercent;

    return {
      top: `${startHour * VIEW_CONFIG.HOUR_HEIGHT}px`,
      height: `${Math.max(durationHours * VIEW_CONFIG.HOUR_HEIGHT, VIEW_CONFIG.MIN_EVENT_HEIGHT)}px`,
      left: `calc(${leftPercent}% + 1px)`,
      width: `calc(${widthPercent}% - 2px)`,
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
          {weekDays.map(({ date, dateStr, layoutEvents }) => {
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

                {/* Events with column layout */}
                {layoutEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={cn(
                      'absolute rounded px-1 py-0.5',
                      'text-xs text-left overflow-hidden',
                      'hover:opacity-80 transition-opacity z-[1]'
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

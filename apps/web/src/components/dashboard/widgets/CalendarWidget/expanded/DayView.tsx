'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { HOUR_SLOTS, VIEW_CONFIG, toLocalDateStr, isoToLocalDateStr } from '../constants';
import type { DayViewProps, CalendarEventDisplay } from '../types';

interface LayoutEvent extends CalendarEventDisplay {
  column: number;
  totalColumns: number;
}

/**
 * Calculate column layout for overlapping events.
 * Groups events that share overlapping time, assigns each a column index
 * and total column count so they can be rendered side-by-side.
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
 * DayView - Single day timeline view
 *
 * Shows events positioned by time on an hourly timeline.
 * Overlapping events are displayed side-by-side in columns.
 */
export const DayView = memo(function DayView({
  currentDate,
  events,
  onEventClick,
  onCreateEvent,
}: DayViewProps) {
  const dateStr = toLocalDateStr(currentDate);

  // Filter events for current day
  const { layoutEvents, allDayEvents } = useMemo(() => {
    const dayEvents = events.filter(
      (e) => isoToLocalDateStr(e.start_time) === dateStr
    );

    const timed = dayEvents.filter((e) => !e.all_day);
    const allDay = dayEvents.filter((e) => e.all_day);

    return {
      layoutEvents: layoutOverlappingEvents(timed),
      allDayEvents: allDay,
    };
  }, [events, dateStr]);

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
      left: `calc(${leftPercent}% + 2px)`,
      width: `calc(${widthPercent}% - 4px)`,
    };
  };

  // Current time indicator position
  const now = new Date();
  const isToday = toLocalDateStr(now) === dateStr;
  const currentTimePosition = isToday
    ? (now.getHours() + now.getMinutes() / 60) * VIEW_CONFIG.HOUR_HEIGHT
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border-subtle p-2">
          <div className="text-xs text-text-muted mb-1">All Day</div>
          <div className="space-y-1">
            {allDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded',
                  'text-sm hover:opacity-80 transition-opacity'
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
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative">
          {/* Time column */}
          <div className="w-20 flex-shrink-0">
            {HOUR_SLOTS.map((hour) => (
              <div
                key={hour}
                className="text-xs text-text-muted text-right pr-3"
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

          {/* Event area */}
          <div className="flex-1 relative border-l border-border-subtle">
            {/* Hour grid lines */}
            {HOUR_SLOTS.map((hour) => (
              <div
                key={hour}
                className={cn(
                  'border-b border-border-subtle/50',
                  'hover:bg-surface-4/30 cursor-pointer transition-colors'
                )}
                style={{ height: VIEW_CONFIG.HOUR_HEIGHT }}
                onClick={() => onCreateEvent(hour)}
              >
                {/* Working hours highlight */}
                {hour >= VIEW_CONFIG.WORKING_HOURS_START &&
                  hour < VIEW_CONFIG.WORKING_HOURS_END && (
                    <div className="absolute inset-0 bg-neon-primary/5 pointer-events-none" />
                  )}
              </div>
            ))}

            {/* Current time indicator */}
            {currentTimePosition !== null && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: currentTimePosition }}
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-error -ml-1.5" />
                  <div className="flex-1 h-0.5 bg-error" />
                </div>
              </div>
            )}

            {/* Events with column layout */}
            {layoutEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className={cn(
                  'absolute rounded-lg px-2 py-1.5',
                  'text-left overflow-hidden shadow-sm',
                  'hover:opacity-90 transition-opacity z-[1]'
                )}
                style={{
                  ...getEventStyle(event),
                  backgroundColor: event.calendarColor + '30',
                  borderLeft: `4px solid ${event.calendarColor}`,
                }}
              >
                <div
                  className="font-medium text-sm truncate"
                  style={{ color: event.calendarColor }}
                >
                  {event.title}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {event.formattedTime}
                </div>
                {event.location && (
                  <div className="text-xs text-text-muted truncate mt-0.5">
                    {event.location}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

DayView.displayName = 'DayView';

export default DayView;

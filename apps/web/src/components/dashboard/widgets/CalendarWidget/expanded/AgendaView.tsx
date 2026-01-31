'use client';

import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowUpDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventCard } from '../components/EventCard';
import { toLocalDateStr, isoToLocalDateStr } from '../constants';
import type { AgendaViewProps, CalendarEventDisplay } from '../types';

type SortMode = 'chronological' | 'reverse' | 'alphabetical' | 'duration';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'chronological', label: 'Earliest first' },
  { id: 'reverse', label: 'Latest first' },
  { id: 'alphabetical', label: 'A-Z by title' },
  { id: 'duration', label: 'Longest first' },
];

/**
 * Group events by date
 */
function groupEventsByDate(
  events: CalendarEventDisplay[]
): Map<string, CalendarEventDisplay[]> {
  const grouped = new Map<string, CalendarEventDisplay[]>();

  for (const event of events) {
    const dateKey = isoToLocalDateStr(event.start_time);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(event);
  }

  return grouped;
}

/**
 * Format date header
 */
function formatDateHeader(dateStr: string): { primary: string; secondary: string; dayOfWeek: string } {
  // Parse YYYY-MM-DD as local midnight (not UTC — `new Date("2026-01-31")` parses as UTC)
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = toLocalDateStr(today);
  const tomorrowStr = toLocalDateStr(tomorrow);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });

  if (dateStr === todayStr) {
    return {
      primary: 'Today',
      secondary: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      }),
      dayOfWeek,
    };
  }

  if (dateStr === tomorrowStr) {
    return {
      primary: 'Tomorrow',
      secondary: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      }),
      dayOfWeek,
    };
  }

  return {
    primary: date.toLocaleDateString('en-US', { weekday: 'long' }),
    secondary: date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    dayOfWeek,
  };
}

/**
 * Format time for the timeline indicator
 */
function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Sort events based on mode
 */
function sortEvents(events: CalendarEventDisplay[], mode: SortMode): CalendarEventDisplay[] {
  const sorted = [...events];
  switch (mode) {
    case 'chronological':
      return sorted.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    case 'reverse':
      return sorted.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    case 'alphabetical':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'duration':
      return sorted.sort((a, b) => b.durationMinutes - a.durationMinutes);
    default:
      return sorted;
  }
}

/**
 * AgendaView - Scrollable list of events grouped by date
 *
 * Shows events in a linear timeline format with time context indicators
 * and sorting controls.
 */
export const AgendaView = memo(function AgendaView({
  events,
  onEventClick,
  onLoadMore,
  hasMore,
}: AgendaViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('chronological');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Sort and then filter to upcoming events, group by date
  const groupedEvents = useMemo(() => {
    const now = new Date();
    const upcoming = events.filter(
      (e) => new Date(e.end_time) >= now
    );
    const sorted = sortEvents(upcoming, sortMode);
    return groupEventsByDate(sorted);
  }, [events, sortMode]);

  const dateKeys = useMemo(() => {
    const keys = Array.from(groupedEvents.keys());
    if (sortMode === 'reverse') {
      return keys.sort().reverse();
    }
    return keys.sort();
  }, [groupedEvents, sortMode]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <Calendar className="h-16 w-16 text-text-muted mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-1">
          No upcoming events
        </h3>
        <p className="text-sm text-text-muted">
          Your schedule is clear. Time to plan something!
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Sort Controls */}
      <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1 rounded hover:bg-surface-4"
          >
            <ArrowUpDown className="h-3 w-3" />
            {SORT_OPTIONS.find((o) => o.id === sortMode)?.label}
          </button>
          {showSortMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-surface-2 border border-border-subtle rounded-lg shadow-xl py-1 min-w-[160px]">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setSortMode(option.id);
                      setShowSortMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      sortMode === option.id
                        ? 'text-neon-primary bg-neon-primary/10'
                        : 'text-text-secondary hover:bg-surface-4'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {dateKeys.map((dateKey, groupIndex) => {
          const dateEvents = groupedEvents.get(dateKey) || [];
          const { primary, secondary } = formatDateHeader(dateKey);

          return (
            <motion.div
              key={dateKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.05 }}
            >
              {/* Date Header */}
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-lg font-semibold text-text-primary">
                  {primary}
                </h3>
                <span className="text-sm text-text-muted">{secondary}</span>
              </div>

              {/* Events for this date with time indicators */}
              <div className="space-y-2 pl-4 border-l-2 border-border-subtle relative">
                {dateEvents.map((event, eventIndex) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIndex * 0.05 + eventIndex * 0.02 }}
                    className="relative"
                  >
                    {/* Time indicator dot and label */}
                    <div className="absolute -left-[21px] top-3 flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full border-2 border-surface-2 flex-shrink-0"
                        style={{ backgroundColor: event.calendarColor }}
                      />
                    </div>
                    <div className="flex items-start gap-3">
                      {/* Time column */}
                      <div className="w-16 flex-shrink-0 pt-2.5">
                        {event.all_day ? (
                          <span className="text-[10px] text-text-muted font-medium">ALL DAY</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-text-muted" />
                            <span className="text-[10px] text-text-muted font-medium">
                              {formatTimeShort(event.startDate)}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Event card */}
                      <div className="flex-1 min-w-0">
                        <EventCard
                          event={event}
                          showCalendar
                          onClick={onEventClick}
                          onJoinMeeting={(url) => window.open(url, '_blank')}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* Load More */}
        {hasMore && onLoadMore && (
          <div className="text-center py-4">
            <button
              onClick={onLoadMore}
              className="text-sm text-neon-primary hover:text-neon-accent transition-colors"
            >
              Load more events
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

AgendaView.displayName = 'AgendaView';

export default AgendaView;

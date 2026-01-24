'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventCard } from '../components/EventCard';
import type { AgendaViewProps, CalendarEventDisplay } from '../types';

/**
 * Group events by date
 */
function groupEventsByDate(
  events: CalendarEventDisplay[]
): Map<string, CalendarEventDisplay[]> {
  const grouped = new Map<string, CalendarEventDisplay[]>();

  for (const event of events) {
    const dateKey = event.start_time.slice(0, 10);
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
function formatDateHeader(dateStr: string): { primary: string; secondary: string } {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dateStr === todayStr) {
    return {
      primary: 'Today',
      secondary: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      }),
    };
  }

  if (dateStr === tomorrowStr) {
    return {
      primary: 'Tomorrow',
      secondary: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      }),
    };
  }

  return {
    primary: date.toLocaleDateString('en-US', { weekday: 'long' }),
    secondary: date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

/**
 * AgendaView - Scrollable list of events grouped by date
 *
 * Shows events in a linear timeline format.
 */
export const AgendaView = memo(function AgendaView({
  events,
  onEventClick,
  onLoadMore,
  hasMore,
}: AgendaViewProps) {
  // Filter to upcoming events and group by date
  const groupedEvents = useMemo(() => {
    const now = new Date();
    const upcoming = events.filter(
      (e) => new Date(e.end_time) >= now
    );
    return groupEventsByDate(upcoming);
  }, [events]);

  const dateKeys = Array.from(groupedEvents.keys()).sort();

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

              {/* Events for this date */}
              <div className="space-y-2 pl-4 border-l-2 border-border-subtle">
                {dateEvents.map((event, eventIndex) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIndex * 0.05 + eventIndex * 0.02 }}
                  >
                    <EventCard
                      event={event}
                      showCalendar
                      onClick={onEventClick}
                      onJoinMeeting={(url) => window.open(url, '_blank')}
                    />
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

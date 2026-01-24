'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Sun, Sunset, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventCard } from '../components/EventCard';
import type { TodayOverviewProps } from '../types';

/**
 * TodayOverview - Today's agenda with time-based sections
 *
 * Shows events grouped by morning/afternoon/evening.
 */
export const TodayOverview = memo(function TodayOverview({
  events,
  onEventClick,
}: TodayOverviewProps) {
  // Group events by time of day
  const groupedEvents = useMemo(() => {
    const morning: typeof events = [];
    const afternoon: typeof events = [];
    const evening: typeof events = [];
    const allDay: typeof events = [];

    events.forEach((event) => {
      if (event.all_day) {
        allDay.push(event);
        return;
      }

      const hour = event.startDate.getHours();
      if (hour < 12) {
        morning.push(event);
      } else if (hour < 17) {
        afternoon.push(event);
      } else {
        evening.push(event);
      }
    });

    return { allDay, morning, afternoon, evening };
  }, [events]);

  const sections = [
    { key: 'allDay', label: 'All Day', icon: Calendar, events: groupedEvents.allDay },
    { key: 'morning', label: 'Morning', icon: Sun, events: groupedEvents.morning },
    { key: 'afternoon', label: 'Afternoon', icon: Sunset, events: groupedEvents.afternoon },
    { key: 'evening', label: 'Evening', icon: Moon, events: groupedEvents.evening },
  ].filter((section) => section.events.length > 0);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar className="h-8 w-8 text-text-muted mb-2" />
        <p className="text-sm text-text-secondary">No events today</p>
        <p className="text-xs text-text-muted">Your schedule is clear</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map(({ key, label, icon: Icon, events: sectionEvents }) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-3 w-3 text-text-muted" />
            <span className="text-xs font-medium text-text-secondary">
              {label}
            </span>
            <span className="text-[10px] text-text-muted">
              ({sectionEvents.length})
            </span>
          </div>

          {/* Events */}
          <div className="space-y-1.5 pl-5">
            {sectionEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isCompact
                onClick={onEventClick}
                onJoinMeeting={(url) => window.open(url, '_blank')}
              />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
});

TodayOverview.displayName = 'TodayOverview';

export default TodayOverview;

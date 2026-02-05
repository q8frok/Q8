'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LinkCalendarPrompt } from '../shared/LinkCalendarPrompt';
import { UpcomingEventsList } from './UpcomingEventsList';
import { TodayOverview } from './TodayOverview';
import { NextEventCard } from './NextEventCard';
import type { CompactView, CalendarEventDisplay } from '../types';

export interface CompactViewContentProps {
  isCheckingAuth: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  calendarError: string | null;
  isSyncing: boolean;
  compactView: CompactView;
  displayEvents: CalendarEventDisplay[];
  todayEvents: CalendarEventDisplay[];
  nextEvent: CalendarEventDisplay | null;
  maxItems: number;
  onEventClick: (event: CalendarEventDisplay) => void;
  onViewAll: () => void;
  onJoinMeeting: (url: string) => void;
  onCreateEvent: () => void;
  onLinkCalendar: () => Promise<void>;
  onRetrySync: () => void;
}

/**
 * Renders the main content area of the CalendarWidget compact view,
 * including loading/error/auth states and animated view transitions.
 */
export const CompactViewContent = memo(function CompactViewContent({
  isCheckingAuth,
  isAuthenticated,
  isLoading,
  calendarError,
  isSyncing,
  compactView,
  displayEvents,
  todayEvents,
  nextEvent,
  maxItems,
  onEventClick,
  onViewAll,
  onJoinMeeting,
  onCreateEvent,
  onLinkCalendar,
  onRetrySync,
}: CompactViewContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {/* Checking auth */}
      {isCheckingAuth && (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="h-8 w-8 border-2 border-neon-primary/50 border-t-neon-primary rounded-full animate-spin mx-auto mb-2" />
            <p className="text-caption">Connecting...</p>
          </div>
        </div>
      )}

      {/* Not authenticated - show link prompt */}
      {!isCheckingAuth && !isAuthenticated && (
        <LinkCalendarPrompt onLink={onLinkCalendar} />
      )}

      {/* Loading state */}
      {isAuthenticated && isLoading && (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="h-8 w-8 border-2 border-neon-primary/50 border-t-neon-primary rounded-full animate-spin mx-auto mb-2" />
            <p className="text-caption">Loading events...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {isAuthenticated && !isLoading && calendarError && (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center px-4">
            <p className="text-caption text-red-400 mb-2">{calendarError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetrySync}
              disabled={isSyncing}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Authenticated - show content */}
      {isAuthenticated && !isLoading && !calendarError && (
        <AnimatePresence mode="wait">
          {compactView === 'upcoming' && (
            <motion.div
              key="upcoming"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full min-h-0"
            >
              <UpcomingEventsList
                events={displayEvents}
                maxItems={maxItems}
                onEventClick={onEventClick}
                onViewAll={onViewAll}
                onJoinMeeting={onJoinMeeting}
              />
            </motion.div>
          )}

          {compactView === 'today' && (
            <motion.div
              key="today"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full"
            >
              <TodayOverview
                events={todayEvents}
                onEventClick={onEventClick}
                onJoinMeeting={onJoinMeeting}
                onCreateEvent={onCreateEvent}
              />
            </motion.div>
          )}

          {compactView === 'next' && (
            <motion.div
              key="next"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full"
            >
              <NextEventCard
                event={nextEvent}
                onEventClick={onEventClick}
                onJoinMeeting={onJoinMeeting}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
});

CompactViewContent.displayName = 'CompactViewContent';

export default CompactViewContent;

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { WidgetActionBar } from '@/components/shared/WidgetActionBar';

// Hooks
import { useCalendarEvents, useNextEvent } from './hooks/useCalendarEvents';
import { useCalendarNavigation } from './hooks/useCalendarNavigation';
import { useCalendarActions } from './hooks/useCalendarActions';

// Store
import { useCalendarStore } from '@/lib/stores/calendar';

// Components
import { CalendarWidgetHeader } from './shared/CalendarWidgetHeader';
import { CompactViewContent } from './compact/CompactViewContent';
import { CalendarModals } from './modals/CalendarModals';

// Types & Constants
import type { CalendarWidgetProps } from './types';
import { COL_SPAN_CLASSES, ROW_SPAN_CLASSES } from './constants';

/**
 * CalendarWidget - Google Calendar integration widget
 *
 * Features:
 * - Multi-calendar support with sync
 * - Compact views: upcoming, today, next
 * - Quick add events
 * - Expanded command center view
 * - Full CRUD operations
 */
export const CalendarWidget = memo(function CalendarWidget({
  maxItems = 5,
  todayOnly = false,
  colSpan = 2,
  rowSpan = 2,
  className,
  defaultView = 'upcoming',
}: CalendarWidgetProps) {
  const {
    isAuthenticated,
    isCheckingAuth,
    isSyncing,
    isExpanded,
    error: calendarError,
    toggleExpanded,
  } = useCalendarStore();

  const nav = useCalendarNavigation(defaultView);
  const actions = useCalendarActions();

  const { events, isLoading } = useCalendarEvents({
    filter: 'upcoming',
    startDate: nav.compactStartDate,
    endDate: nav.compactEndDate,
  });

  const { event: nextEvent } = useNextEvent();

  const todayEventsResult = useCalendarEvents({
    startDate: nav.compactStartDate,
    endDate: nav.todayEndDate,
  });
  const todayEvents = todayEventsResult.events;
  const displayEvents = todayOnly ? todayEvents : events;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'surface-matte p-4 flex flex-col overflow-hidden w-full',
          COL_SPAN_CLASSES[colSpan],
          ROW_SPAN_CLASSES[rowSpan],
          className
        )}
      >
        <CalendarWidgetHeader
          isAuthenticated={isAuthenticated}
          isSyncing={isSyncing}
          compactView={nav.compactView}
          compactDateLabel={nav.compactDateLabel}
          onCompactViewChange={nav.setCompactView}
          onSync={() => actions.syncEvents()}
          onQuickAdd={() => actions.setShowQuickAdd(true)}
          onExpand={toggleExpanded}
          onSettings={() => actions.setShowSettings(true)}
          onCompactPrev={nav.handleCompactPrev}
          onCompactNext={nav.handleCompactNext}
          onCompactToday={nav.handleCompactToday}
        />

        <WidgetActionBar
          widgetLabel="Calendar"
          className="mb-3"
          context={{
            compactView: nav.compactView,
            eventsVisible: displayEvents.length,
            todayEvents: todayEvents.length,
            nextEvent: nextEvent
              ? {
                  title: nextEvent.title,
                  startsAt: nextEvent.start_time,
                }
              : null,
          }}
          quickActions={[
            {
              id: 'summarize-day',
              label: 'Summarize day',
              prompt: 'Summarize my day from calendar and flag schedule risks.',
            },
            {
              id: 'prep-next',
              label: 'Prep next meeting',
              prompt: 'Help me prep for my next meeting with a quick briefing and checklist.',
            },
          ]}
        />

        <CompactViewContent
          isCheckingAuth={isCheckingAuth}
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          calendarError={calendarError}
          isSyncing={isSyncing}
          compactView={nav.compactView}
          displayEvents={displayEvents}
          todayEvents={todayEvents}
          nextEvent={nextEvent}
          maxItems={maxItems}
          onEventClick={actions.handleEventClick}
          onViewAll={toggleExpanded}
          onJoinMeeting={actions.handleJoinMeeting}
          onCreateEvent={() => actions.setShowQuickAdd(true)}
          onLinkCalendar={actions.linkCalendar}
          onRetrySync={() => actions.syncEvents({ forceRefresh: true })}
        />
      </motion.div>

      <CalendarModals
        showSettings={actions.showSettings}
        onCloseSettings={() => actions.setShowSettings(false)}
        showQuickAdd={actions.showQuickAdd}
        onCloseQuickAdd={() => actions.setShowQuickAdd(false)}
        onQuickAddSave={actions.handleQuickAddSave}
        selectedEvent={actions.selectedEventForModal}
        onCloseEventDetail={actions.handleCloseEventDetail}
        onEditEvent={actions.handleEventEdit}
        onDeleteEvent={actions.handleEventDelete}
        isExpanded={isExpanded}
        onCloseExpanded={toggleExpanded}
      />
    </>
  );
});

CalendarWidget.displayName = 'CalendarWidget';

export default CalendarWidget;

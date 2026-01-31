'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Settings,
  Maximize2,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Hooks
import { useCalendarSync } from './hooks/useCalendarSync';
import { useCalendarEvents, useNextEvent } from './hooks/useCalendarEvents';

// Store
import { useCalendarStore } from '@/lib/stores/calendar';

// Components
import { UpcomingEventsList } from './compact/UpcomingEventsList';
import { TodayOverview } from './compact/TodayOverview';
import { NextEventCard } from './compact/NextEventCard';
import { CalendarSettings } from './shared/CalendarSettings';
import { SyncStatus } from './shared/SyncStatus';
import { LinkCalendarPrompt } from './shared/LinkCalendarPrompt';
import { QuickAddModal } from './modals/QuickAddModal';
import { EventDetailModal } from './modals/EventDetailModal';
import { CalendarCommandCenter } from './expanded/CalendarCommandCenter';

// Types & Constants
import type { CalendarWidgetProps, CompactView, CalendarEventDisplay, CalendarEventInput } from './types';
import { COMPACT_VIEWS } from './constants';

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
  // Store state
  const {
    isAuthenticated,
    isCheckingAuth,
    isSyncing,
    isExpanded,
    error: calendarError,
    toggleExpanded,
  } = useCalendarStore();

  // Hooks
  const {
    syncEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    linkCalendar,
  } = useCalendarSync();

  // Local state
  const [compactView, setCompactView] = useState<CompactView>(defaultView);
  const [compactDate, setCompactDate] = useState<Date>(new Date());

  // Compact date navigation
  const compactDateLabel = useMemo(() => {
    const today = new Date();
    const isToday =
      compactDate.getFullYear() === today.getFullYear() &&
      compactDate.getMonth() === today.getMonth() &&
      compactDate.getDate() === today.getDate();
    if (isToday) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      compactDate.getFullYear() === tomorrow.getFullYear() &&
      compactDate.getMonth() === tomorrow.getMonth() &&
      compactDate.getDate() === tomorrow.getDate();
    if (isTomorrow) return 'Tomorrow';
    return compactDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [compactDate]);

  const handleCompactPrev = useCallback(() => {
    setCompactDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const handleCompactNext = useCallback(() => {
    setCompactDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const handleCompactToday = useCallback(() => {
    setCompactDate(new Date());
  }, []);

  // Date range for compact view filtering
  const compactStartDate = useMemo(() => {
    const d = new Date(compactDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [compactDate]);

  const compactEndDate = useMemo(() => {
    const d = new Date(compactDate);
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [compactDate]);

  const { events, isLoading } = useCalendarEvents({
    filter: 'upcoming',
    startDate: compactStartDate,
    endDate: compactEndDate,
  });

  const { event: nextEvent } = useNextEvent();

  // Today events for the selected compact date
  const todayEventsRaw = useCalendarEvents({
    startDate: compactStartDate,
    endDate: useMemo(() => {
      const d = new Date(compactDate);
      d.setHours(23, 59, 59, 999);
      return d;
    }, [compactDate]),
  });
  const todayEvents = todayEventsRaw.events;
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<CalendarEventDisplay | null>(null);
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting for portals
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialization is handled inside useCalendarSync hook

  // Handle event click
  const handleEventClick = useCallback((event: CalendarEventDisplay) => {
    setSelectedEventForModal(event);
  }, []);

  // Handle meeting join
  const handleJoinMeeting = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  // Handle event save from quick add
  const handleQuickAddSave = useCallback(async (eventInput: CalendarEventInput): Promise<void> => {
    await createEvent(eventInput);
  }, [createEvent]);

  // Handle event edit from modal
  const handleEventEdit = useCallback((event: CalendarEventDisplay) => {
    // Open expanded view with event selected for editing
    toggleExpanded();
    setSelectedEventForModal(null);
  }, [toggleExpanded]);

  // Handle event delete from modal
  const handleEventDelete = useCallback(async (eventId: string) => {
    const event = selectedEventForModal;
    if (event) {
      await deleteEvent(eventId, event.google_calendar_id);
      setSelectedEventForModal(null);
    }
  }, [deleteEvent, selectedEventForModal]);

  // Grid span classes
  const colSpanClasses: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-3',
    4: 'col-span-1 md:col-span-4',
  };

  const rowSpanClasses: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4',
  };

  // Filter events based on todayOnly prop
  const displayEvents = todayOnly ? todayEvents : events;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'surface-matte p-4 flex flex-col overflow-hidden w-full',
          colSpanClasses[colSpan],
          rowSpanClasses[rowSpan],
          className
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 mb-3 space-y-1.5">
          {/* Row 1: Title + Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neon-primary flex-shrink-0" />
              <h3 className="text-heading text-sm whitespace-nowrap">Calendar</h3>
            </div>

            {/* Actions - always visible */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {isAuthenticated && (
                <>
                  <SyncStatus compact />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => syncEvents()}
                    disabled={isSyncing}
                    className="h-7 w-7"
                    title="Sync calendar"
                  >
                    <RefreshCw
                      className={cn(
                        'h-3.5 w-3.5',
                        isSyncing && 'animate-spin'
                      )}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowQuickAdd(true)}
                    className="h-7 w-7"
                    title="Add event"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleExpanded}
                    className="h-7 w-7"
                    title="Expand calendar"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-7 w-7"
                title="Calendar settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Row 2: View Selector + Date Navigation */}
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={compactView}
                  onChange={(e) => setCompactView(e.target.value as CompactView)}
                  className={cn(
                    'appearance-none bg-transparent',
                    'text-xs text-text-muted',
                    'pr-4 cursor-pointer',
                    'hover:text-text-secondary transition-colors',
                    'focus:outline-none'
                  )}
                >
                  {COMPACT_VIEWS.map((view: { id: CompactView; label: string }) => (
                    <option key={view.id} value={view.id}>
                      {view.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted pointer-events-none" />
              </div>

              {(compactView === 'upcoming' || compactView === 'today') && (
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCompactPrev}
                    className="h-6 w-6"
                    title="Previous day"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={handleCompactToday}
                    className="text-[10px] text-text-muted hover:text-text-secondary transition-colors px-1 min-w-[52px] text-center"
                    title="Go to today"
                  >
                    {compactDateLabel}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCompactNext}
                    className="h-6 w-6"
                    title="Next day"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
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
            <LinkCalendarPrompt onLink={linkCalendar} />
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
                  onClick={() => syncEvents({ forceRefresh: true })}
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
                    onEventClick={handleEventClick}
                    onViewAll={toggleExpanded}
                    onJoinMeeting={handleJoinMeeting}
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
                    onEventClick={handleEventClick}
                    onJoinMeeting={handleJoinMeeting}
                    onCreateEvent={() => setShowQuickAdd(true)}
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
                    onEventClick={handleEventClick}
                    onJoinMeeting={handleJoinMeeting}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Settings Drawer */}
      <CalendarSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSave={handleQuickAddSave}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEventForModal}
        isOpen={!!selectedEventForModal}
        onClose={() => setSelectedEventForModal(null)}
        onEdit={handleEventEdit}
        onDelete={handleEventDelete}
      />

      {/* Expanded Command Center - Portal to body */}
      {mounted &&
        isExpanded &&
        createPortal(
          <CalendarCommandCenter onClose={toggleExpanded} />,
          document.body
        )}
    </>
  );
});

CalendarWidget.displayName = 'CalendarWidget';

export default CalendarWidget;

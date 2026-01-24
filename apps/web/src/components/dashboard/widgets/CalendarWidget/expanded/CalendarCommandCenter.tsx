'use client';

import { memo, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minimize2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/lib/stores/calendar';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { CalendarSidebar } from './CalendarSidebar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { AgendaView } from './AgendaView';
import { EventDetailPanel } from './EventDetailPanel';
import { CreateEventForm } from './CreateEventForm';
import { SyncStatus } from '../shared/SyncStatus';
import { MONTH_NAMES_FULL } from '../constants';
import type { CalendarCommandCenterProps, CalendarEvent, CalendarEventInput } from '../types';

/**
 * CalendarCommandCenter - Fullscreen calendar expanded view
 *
 * Full-featured calendar with month/week/day/agenda views.
 */
export const CalendarCommandCenter = memo(function CalendarCommandCenter({
  onClose,
  initialView = 'month',
  initialDate,
  selectedEventId,
}: CalendarCommandCenterProps) {
  const {
    calendars,
    selectedCalendarIds,
    currentView,
    currentDate,
    selectedEventId: storeSelectedEventId,
    isCreatingEvent,
    setCurrentView,
    setCurrentDate,
    setSelectedEvent,
    goToToday,
    goToPrevious,
    goToNext,
    setCreatingEvent,
    toggleCalendar,
  } = useCalendarStore();

  const {
    isSyncing,
    lastSyncAt,
    error,
    fetchCalendars,
    syncEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarSync();

  const { events } = useCalendarEvents();

  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [createEventDate, setCreateEventDate] = useState<Date | undefined>();
  const [createEventHour, setCreateEventHour] = useState<number | undefined>();

  // Initialize on mount
  useEffect(() => {
    if (initialView) setCurrentView(initialView);
    if (initialDate) setCurrentDate(initialDate);
    if (selectedEventId) setSelectedEvent(selectedEventId);
    if (calendars.length === 0) fetchCalendars();
  }, []);

  // Get selected event
  const selectedEvent = storeSelectedEventId
    ? events.find((e) => e.id === storeSelectedEventId) || null
    : null;

  // Format header title
  const headerTitle = (() => {
    const year = currentDate.getFullYear();
    const month = MONTH_NAMES_FULL[currentDate.getMonth()];

    switch (currentView) {
      case 'month':
        return `${month} ${year}`;
      case 'week': {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${MONTH_NAMES_FULL[weekStart.getMonth()] ?? 'Unknown'} ${weekStart.getDate()}-${weekEnd.getDate()}, ${year}`;
        }
        return `${(MONTH_NAMES_FULL[weekStart.getMonth()] ?? 'Unknown').slice(0, 3)} ${weekStart.getDate()} - ${(MONTH_NAMES_FULL[weekEnd.getMonth()] ?? 'Unknown').slice(0, 3)} ${weekEnd.getDate()}, ${year}`;
      }
      case 'day':
        return currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      case 'agenda':
        return 'Agenda';
      default:
        return `${month} ${year}`;
    }
  })();

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event.id);
    setIsEditingEvent(false);
  }, [setSelectedEvent]);

  const handleCreateEvent = useCallback(
    (date: Date, hour?: number) => {
      setCreateEventDate(date);
      setCreateEventHour(hour);
      setCreatingEvent(true);
    },
    [setCreatingEvent]
  );

  const handleSaveEvent = useCallback(
    async (eventData: CalendarEventInput) => {
      await createEvent(eventData);
      setCreatingEvent(false);
      syncEvents();
    },
    [createEvent, setCreatingEvent, syncEvents]
  );

  const handleUpdateEvent = useCallback(
    async (eventData: CalendarEventInput) => {
      if (!selectedEvent) return;
      await updateEvent(selectedEvent.google_event_id, eventData);
      setIsEditingEvent(false);
      syncEvents();
    },
    [selectedEvent, updateEvent, syncEvents]
  );

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent) return;
    await deleteEvent(selectedEvent.google_event_id, selectedEvent.google_calendar_id);
    setSelectedEvent(null);
    syncEvents();
  }, [selectedEvent, deleteEvent, setSelectedEvent, syncEvents]);

  const handleClosePanel = useCallback(() => {
    setSelectedEvent(null);
    setIsEditingEvent(false);
  }, [setSelectedEvent]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl"
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <Minimize2 className="h-5 w-5" />
      </Button>

      <div className="h-full flex">
        {/* Sidebar */}
        <CalendarSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedDate={currentDate}
          onDateSelect={setCurrentDate}
          calendars={calendars}
          selectedCalendarIds={selectedCalendarIds}
          onCalendarToggle={toggleCalendar}
          onAddEvent={() => handleCreateEvent(new Date())}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-4">
              <Calendar className="h-6 w-6 text-neon-primary" />
              <div>
                <h1 className="text-xl font-bold text-white">{headerTitle}</h1>
                <SyncStatus
                  lastSyncAt={lastSyncAt}
                  isSyncing={isSyncing}
                  onSync={() => syncEvents({ forceRefresh: true })}
                  error={error}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="text-white/70 hover:text-white"
              >
                Today
              </Button>
              <div className="flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevious}
                  className="h-8 w-8 text-white/70 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="h-8 w-8 text-white/70 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleCreateEvent(new Date())}
                className="ml-2 bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Event
              </Button>
            </div>
          </div>

          {/* View Content */}
          <div className="flex-1 overflow-hidden flex">
            <div className={cn('flex-1 overflow-auto', selectedEvent && 'mr-80')}>
              <AnimatePresence mode="wait">
                {currentView === 'month' && (
                  <motion.div
                    key="month"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <MonthView
                      currentDate={currentDate}
                      events={events}
                      selectedDate={null}
                      onDateSelect={setCurrentDate}
                      onEventClick={handleEventClick}
                      onCreateEvent={handleCreateEvent}
                    />
                  </motion.div>
                )}
                {currentView === 'week' && (
                  <motion.div
                    key="week"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <WeekView
                      currentDate={currentDate}
                      events={events}
                      selectedDate={null}
                      onDateSelect={setCurrentDate}
                      onEventClick={handleEventClick}
                      onCreateEvent={handleCreateEvent}
                    />
                  </motion.div>
                )}
                {currentView === 'day' && (
                  <motion.div
                    key="day"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <DayView
                      currentDate={currentDate}
                      events={events}
                      onEventClick={handleEventClick}
                      onCreateEvent={(hour) => handleCreateEvent(currentDate, hour)}
                    />
                  </motion.div>
                )}
                {currentView === 'agenda' && (
                  <motion.div
                    key="agenda"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <AgendaView
                      events={events}
                      onEventClick={handleEventClick}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Event Detail Panel */}
            <AnimatePresence>
              {selectedEvent && (
                <EventDetailPanel
                  event={selectedEvent}
                  isEditing={isEditingEvent}
                  onClose={handleClosePanel}
                  onEdit={() => setIsEditingEvent(true)}
                  onSave={handleUpdateEvent}
                  onDelete={handleDeleteEvent}
                  onCancelEdit={() => setIsEditingEvent(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Create Event Form */}
      <CreateEventForm
        isOpen={isCreatingEvent}
        onClose={() => setCreatingEvent(false)}
        defaultDate={createEventDate}
        defaultHour={createEventHour}
        calendars={calendars}
        onSave={handleSaveEvent}
      />
    </motion.div>
  );
});

CalendarCommandCenter.displayName = 'CalendarCommandCenter';

export default CalendarCommandCenter;

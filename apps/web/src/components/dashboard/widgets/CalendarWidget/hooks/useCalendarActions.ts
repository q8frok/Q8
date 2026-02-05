'use client';

import { useState, useCallback } from 'react';
import { useCalendarSync } from './useCalendarSync';
import { useCalendarStore } from '@/lib/stores/calendar';
import type { CalendarEventDisplay, CalendarEventInput } from '../types';

export interface UseCalendarActionsReturn {
  // Sync actions (pass-through)
  syncEvents: (options?: { forceRefresh?: boolean }) => Promise<void>;
  createEvent: (event: CalendarEventInput) => Promise<unknown>;
  linkCalendar: () => Promise<void>;

  // Modal state
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showQuickAdd: boolean;
  setShowQuickAdd: (show: boolean) => void;
  selectedEventForModal: CalendarEventDisplay | null;

  // Event handlers
  handleEventClick: (event: CalendarEventDisplay) => void;
  handleJoinMeeting: (url: string) => void;
  handleQuickAddSave: (eventInput: CalendarEventInput) => Promise<void>;
  handleEventEdit: (event: CalendarEventDisplay) => void;
  handleEventDelete: (eventId: string) => Promise<void>;
  handleCloseEventDetail: () => void;
}

/**
 * Manages CalendarWidget action handlers and modal state.
 */
export function useCalendarActions(): UseCalendarActionsReturn {
  const { toggleExpanded } = useCalendarStore();
  const {
    syncEvents,
    createEvent,
    deleteEvent,
    linkCalendar,
  } = useCalendarSync();

  // Modal state
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<CalendarEventDisplay | null>(null);

  const handleEventClick = useCallback((event: CalendarEventDisplay) => {
    setSelectedEventForModal(event);
  }, []);

  const handleJoinMeeting = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  const handleQuickAddSave = useCallback(async (eventInput: CalendarEventInput): Promise<void> => {
    await createEvent(eventInput);
  }, [createEvent]);

  const handleEventEdit = useCallback((_event: CalendarEventDisplay) => {
    toggleExpanded();
    setSelectedEventForModal(null);
  }, [toggleExpanded]);

  const handleEventDelete = useCallback(async (eventId: string) => {
    const event = selectedEventForModal;
    if (event) {
      await deleteEvent(eventId, event.google_calendar_id);
      setSelectedEventForModal(null);
    }
  }, [deleteEvent, selectedEventForModal]);

  const handleCloseEventDetail = useCallback(() => {
    setSelectedEventForModal(null);
  }, []);

  return {
    syncEvents,
    createEvent,
    linkCalendar,
    showSettings,
    setShowSettings,
    showQuickAdd,
    setShowQuickAdd,
    selectedEventForModal,
    handleEventClick,
    handleJoinMeeting,
    handleQuickAddSave,
    handleEventEdit,
    handleEventDelete,
    handleCloseEventDetail,
  };
}

export default useCalendarActions;

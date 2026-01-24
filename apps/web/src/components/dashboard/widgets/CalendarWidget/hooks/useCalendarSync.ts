'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCalendarStore } from '@/lib/stores/calendar';
import { logger } from '@/lib/logger';
import type {
  GoogleCalendar,
  CalendarEvent,
  CalendarEventInput,
  UseCalendarSyncReturn,
} from '../types';
import { SYNC_CONFIG, ERROR_MESSAGES } from '../constants';

/**
 * Safely parse JSON from a response, returning null if it fails
 */
async function safeJsonParse<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * useCalendarSync Hook
 *
 * Handles Google Calendar authentication, data fetching, syncing, and CRUD operations.
 */
export function useCalendarSync(): UseCalendarSyncReturn {
  const {
    calendars,
    selectedCalendarIds,
    events,
    isSyncing,
    lastSyncAt,
    error,
    isAuthenticated,
    isCheckingAuth,
    setCalendars,
    setEvents,
    addEvent,
    updateEvent: updateEventInStore,
    removeEvent,
    toggleCalendar,
    setSyncing,
    setLastSyncAt,
    setError,
    setAuthenticated,
    setCheckingAuth,
  } = useCalendarStore();

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  /**
   * Check if user has linked Google accounts with calendar access
   */
  const checkAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      // Check for linked Google accounts via API
      const response = await fetch('/api/auth/google-accounts');
      if (!response.ok) {
        setAuthenticated(false);
        return false;
      }
      const data = await response.json();
      const hasAccounts = Array.isArray(data.accounts) && data.accounts.length > 0;
      setAuthenticated(hasAccounts);
      return hasAccounts;
    } catch (err) {
      logger.error('[Calendar Sync] Auth check failed', { error: err });
      setAuthenticated(false);
      return false;
    } finally {
      setCheckingAuth(false);
    }
  }, [setAuthenticated, setCheckingAuth]);

  /**
   * Fetch user's Google Calendar list
   */
  const fetchCalendars = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/calendar/list');

      if (!response.ok) {
        // Try to parse error response for more details
        const errorData = await safeJsonParse<{
          error?: string;
          needsRelink?: boolean;
          insufficientScopes?: boolean;
        }>(response);

        if (response.status === 401 || response.status === 403) {
          setAuthenticated(false);

          // Check if this is a scope issue (user linked before calendar scopes were added)
          if (errorData?.insufficientScopes || response.status === 403) {
            setError(
              'Calendar access denied. Please re-link your Google account to grant calendar permissions. Go to Settings > Link Google Account.'
            );
            logger.warn('[Calendar Sync] Insufficient scopes - user needs to re-link', {
              status: response.status,
            });
          } else {
            setError(ERROR_MESSAGES.AUTH_REQUIRED);
          }
          return;
        }
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }

      const data = await safeJsonParse<{ calendars: GoogleCalendar[] }>(response);

      if (data?.calendars) {
        setCalendars(data.calendars);
        logger.info('[Calendar Sync] Fetched calendars', {
          count: data.calendars.length,
        });
      }
    } catch (err) {
      logger.error('[Calendar Sync] Error fetching calendars', { error: err });
      setError(ERROR_MESSAGES.FETCH_CALENDARS);
    }
  }, [setCalendars, setError, setAuthenticated]);

  /**
   * Sync events from Google Calendar
   */
  const syncEvents = useCallback(
    async (options: { forceRefresh?: boolean } = {}) => {
      // Prevent rapid re-syncing
      const now = Date.now();
      if (
        now - lastSyncRef.current < 30000 &&
        !options.forceRefresh
      ) {
        logger.debug('[Calendar Sync] Sync skipped - too soon since last sync');
        return;
      }

      if (selectedCalendarIds.length === 0) {
        logger.warn('[Calendar Sync] No calendars selected');
        return;
      }

      setSyncing(true);
      setError(null);
      lastSyncRef.current = now;

      try {
        const response = await fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarIds: selectedCalendarIds,
            forceRefresh: options.forceRefresh,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            setAuthenticated(false);
            setError(ERROR_MESSAGES.AUTH_REQUIRED);
            return;
          }
          throw new Error(`Sync failed: ${response.status}`);
        }

        const data = await safeJsonParse<{
          synced: number;
          deleted: number;
          lastSyncAt: string;
        }>(response);

        if (data) {
          setLastSyncAt(data.lastSyncAt);
          logger.info('[Calendar Sync] Sync completed', {
            synced: data.synced,
            deleted: data.deleted,
          });

          // Fetch fresh events after sync
          await fetchEvents();
        }
      } catch (err) {
        logger.error('[Calendar Sync] Error syncing', { error: err });
        setError(ERROR_MESSAGES.SYNC_EVENTS);
      } finally {
        setSyncing(false);
      }
    },
    [selectedCalendarIds, setSyncing, setError, setLastSyncAt, setAuthenticated]
  );

  /**
   * Fetch events from API
   */
  const fetchEvents = useCallback(async () => {
    if (selectedCalendarIds.length === 0) return;

    try {
      const params = new URLSearchParams({
        calendarIds: selectedCalendarIds.join(','),
        timeMin: new Date(
          Date.now() - SYNC_CONFIG.SYNC_PAST_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
        timeMax: new Date(
          Date.now() + SYNC_CONFIG.SYNC_FUTURE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      const response = await fetch(`/api/calendar/events?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const data = await safeJsonParse<{ events: CalendarEvent[] }>(response);

      if (data?.events) {
        setEvents(data.events);
      }
    } catch (err) {
      logger.error('[Calendar Sync] Error fetching events', { error: err });
    }
  }, [selectedCalendarIds, setEvents]);

  /**
   * Create a new event
   */
  const createEvent = useCallback(
    async (eventInput: CalendarEventInput): Promise<CalendarEvent> => {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventInput),
      });

      if (!response.ok) {
        const errorData = await safeJsonParse<{ error: string }>(response);
        throw new Error(errorData?.error || ERROR_MESSAGES.CREATE_EVENT);
      }

      const data = await safeJsonParse<{ event: CalendarEvent }>(response);

      if (!data?.event) {
        throw new Error(ERROR_MESSAGES.CREATE_EVENT);
      }

      // Add to local store
      addEvent(data.event);

      logger.info('[Calendar Sync] Event created', { eventId: data.event.id });
      return data.event;
    },
    [addEvent]
  );

  /**
   * Update an existing event
   */
  const updateEvent = useCallback(
    async (
      eventId: string,
      updates: Partial<CalendarEventInput>
    ): Promise<CalendarEvent> => {
      // Find the event to get calendar ID
      const existingEvent = events.find((e) => e.google_event_id === eventId);
      if (!existingEvent) {
        throw new Error('Event not found');
      }

      const response = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          calendarId: existingEvent.google_calendar_id,
          updates,
        }),
      });

      if (!response.ok) {
        const errorData = await safeJsonParse<{ error: string }>(response);
        throw new Error(errorData?.error || ERROR_MESSAGES.UPDATE_EVENT);
      }

      const data = await safeJsonParse<{ event: CalendarEvent }>(response);

      if (!data?.event) {
        throw new Error(ERROR_MESSAGES.UPDATE_EVENT);
      }

      // Update in local store
      updateEventInStore(existingEvent.id, data.event);

      logger.info('[Calendar Sync] Event updated', { eventId: data.event.id });
      return data.event;
    },
    [events, updateEventInStore]
  );

  /**
   * Delete an event
   */
  const deleteEvent = useCallback(
    async (eventId: string, calendarId: string): Promise<void> => {
      const params = new URLSearchParams({ eventId, calendarId });

      const response = await fetch(`/api/calendar/events?${params}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await safeJsonParse<{ error: string }>(response);
        throw new Error(errorData?.error || ERROR_MESSAGES.DELETE_EVENT);
      }

      // Find and remove from local store
      const localEvent = events.find(
        (e) =>
          e.google_event_id === eventId && e.google_calendar_id === calendarId
      );
      if (localEvent) {
        removeEvent(localEvent.id);
      }

      logger.info('[Calendar Sync] Event deleted', { eventId, calendarId });
    },
    [events, removeEvent]
  );

  /**
   * Initiate Google Calendar linking (add new account)
   */
  const linkCalendar = useCallback(async () => {
    // Redirect to add Google account flow
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/add-google-account?scopes=calendar&redirect=${redirect}`;
  }, []);

  /**
   * Start periodic sync
   */
  const startPeriodicSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const doSync = async () => {
      await syncEvents();
      syncTimeoutRef.current = setTimeout(doSync, SYNC_CONFIG.AUTO_SYNC_INTERVAL);
    };

    syncTimeoutRef.current = setTimeout(doSync, SYNC_CONFIG.AUTO_SYNC_INTERVAL);
  }, [syncEvents]);

  /**
   * Stop periodic sync
   */
  const stopPeriodicSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPeriodicSync();
    };
  }, [stopPeriodicSync]);

  return {
    // Data
    calendars,
    selectedCalendarIds,

    // Auth
    isAuthenticated,
    isCheckingAuth,

    // Sync
    isSyncing,
    lastSyncAt,
    error,

    // Actions
    fetchCalendars,
    syncEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleCalendar,
    linkCalendar,
  };
}

export default useCalendarSync;

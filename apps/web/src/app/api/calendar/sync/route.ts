/**
 * Calendar Sync API
 *
 * POST /api/calendar/sync - Full sync events from all linked Google accounts
 *
 * Syncs events from selected calendars across all linked accounts and stores them in Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { getAllGoogleTokens, getGoogleAccounts, type GoogleAccountToken } from '@/lib/auth/google-accounts';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { getServerEnv } from '@/lib/env';
import type { CalendarEvent, SyncResponse } from '@/components/dashboard/widgets/CalendarWidget/types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// Get server environment variables
const serverEnv = getServerEnv();

// Supabase admin client for server-side operations
const supabaseAdmin = createClient(
  serverEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY
);

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
    optional?: boolean;
  }>;
  colorId?: string;
  recurrence?: string[];
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
  hangoutLink?: string;
  status?: string;
  visibility?: string;
  created?: string;
  updated?: string;
}

interface LinkedAccount {
  id: string;
  email: string;
  label: string | null;
}

/**
 * Transform Google Calendar event to our database format
 */
function transformEventForDB(
  event: GoogleCalendarEvent,
  calendarId: string,
  calendarName: string,
  userId: string,
  googleAccountId: string
): Omit<CalendarEvent, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string } {
  const meetingUrl =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;

  const isAllDay = !event.start.dateTime;
  const startTime = event.start.dateTime || `${event.start.date}T00:00:00`;
  const endTime = event.end.dateTime || `${event.end.date}T23:59:59`;

  return {
    id: `${googleAccountId}_${calendarId}_${event.id}`,
    user_id: userId,
    title: event.summary || '(No title)',
    description: event.description || undefined,
    start_time: startTime,
    end_time: endTime,
    all_day: isAllDay,
    location: event.location || undefined,
    meeting_url: meetingUrl || undefined,
    attendees: (event.attendees || []).map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: (a.responseStatus || 'needsAction') as 'needsAction' | 'declined' | 'tentative' | 'accepted',
      organizer: a.organizer,
      self: a.self,
      optional: a.optional,
    })),
    color: event.colorId || undefined,
    calendar_name: calendarName,
    google_calendar_id: calendarId,
    google_event_id: event.id,
    google_account_id: googleAccountId,
    recurrence: event.recurrence || undefined,
    reminders:
      event.reminders?.overrides?.map((r) => ({
        method: r.method as 'email' | 'popup',
        minutes: r.minutes,
      })) || undefined,
    status: (event.status || 'confirmed') as 'confirmed' | 'tentative' | 'cancelled',
    visibility: event.visibility as 'default' | 'public' | 'private' | 'confidential' | undefined,
  };
}

/**
 * Fetch events for a specific calendar using a token
 */
async function fetchCalendarEvents(
  calendarId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<{ calendarName: string; events: GoogleCalendarEvent[] } | null> {
  try {
    // Get calendar info for name
    const calendarResponse = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let calendarName = calendarId;
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarName = calendarData.summary || calendarId;
    }

    // Fetch events
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: '250',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const eventsResponse = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    if (!eventsResponse.ok) {
      logger.warn('[Calendar Sync] Failed to fetch events', {
        calendarId,
        status: eventsResponse.status,
      });
      return null;
    }

    const eventsData = await eventsResponse.json();
    const events: GoogleCalendarEvent[] = eventsData.items || [];

    return { calendarName, events: events.filter((e) => e.status !== 'cancelled') };
  } catch (err) {
    logger.error('[Calendar Sync] Error fetching calendar events', {
      calendarId,
      error: err,
    });
    return null;
  }
}

/**
 * POST /api/calendar/sync
 *
 * Body:
 * - calendarIds: string[] - Calendar IDs to sync
 * - forceRefresh?: boolean - Force full sync
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { calendarIds, forceRefresh = false } = body;

    if (!calendarIds || !Array.isArray(calendarIds) || calendarIds.length === 0) {
      return NextResponse.json({ error: 'calendarIds array is required' }, { status: 400 });
    }

    // Get all linked accounts and tokens
    const accounts = await getGoogleAccounts(user.id);
    const tokens = await getAllGoogleTokens(user.id);

    logger.info('[Calendar Sync] Retrieved accounts and tokens', {
      userId: user.id,
      accountCount: accounts.length,
      tokenCount: tokens.length,
      accounts: accounts.map(a => ({ id: a.id, email: a.email })),
      tokens: tokens.map(t => ({ accountId: t.accountId, email: t.email, hasAccessToken: !!t.accessToken })),
    });

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'No Google accounts linked', authenticated: false },
        { status: 401 }
      );
    }

    // Create token lookup by account ID
    const tokenMap = new Map<string, GoogleAccountToken>();
    for (const token of tokens) {
      tokenMap.set(token.accountId, token);
    }

    // Create account lookup
    const accountMap = new Map<string, LinkedAccount>();
    for (const account of accounts) {
      accountMap.set(account.id, {
        id: account.id,
        email: account.email,
        label: account.label,
      });
    }

    // Calculate time range for sync
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    let totalSynced = 0;
    let totalDeleted = 0;
    const allEvents: CalendarEvent[] = [];
    const syncedCalendarIds: string[] = [];

    // Process each calendar - need to find which account has access
    for (const calendarId of calendarIds) {
      let synced = false;

      // Try each account's token to sync this calendar
      for (const token of tokens) {
        if (!token.accessToken) continue;

        const result = await fetchCalendarEvents(calendarId, token.accessToken, timeMin, timeMax);

        if (result) {
          // Transform events with account attribution
          const transformedEvents = result.events.map((event) =>
            transformEventForDB(event, calendarId, result.calendarName, user.id, token.accountId)
          );

          allEvents.push(...(transformedEvents as CalendarEvent[]));
          totalSynced += transformedEvents.length;
          syncedCalendarIds.push(calendarId);
          synced = true;

          const account = accountMap.get(token.accountId);
          logger.info('[Calendar Sync] Synced calendar', {
            calendarId,
            accountEmail: account?.email,
            eventCount: transformedEvents.length,
          });

          break; // Found the right account, move to next calendar
        }
      }

      if (!synced) {
        logger.warn('[Calendar Sync] Could not sync calendar - no account has access', {
          calendarId,
        });
      }
    }

    // Upsert events to Supabase
    if (allEvents.length > 0) {
      // Delete old events from synced calendars first (if force refresh)
      if (forceRefresh && syncedCalendarIds.length > 0) {
        const { error: deleteError, count } = await supabaseAdmin
          .from('calendar_events')
          .delete()
          .eq('user_id', user.id)
          .in('google_calendar_id', syncedCalendarIds);

        if (deleteError) {
          logger.error('[Calendar Sync] Error deleting old events', { error: deleteError });
        } else {
          totalDeleted = count || 0;
        }
      }

      // Upsert all events
      const { error: upsertError } = await supabaseAdmin.from('calendar_events').upsert(
        allEvents.map((e) => ({
          ...e,
          created_at: e.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      );

      if (upsertError) {
        logger.error('[Calendar Sync] Error upserting events', {
          error: upsertError,
          code: upsertError.code,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
          eventCount: allEvents.length,
          sampleEvent: allEvents[0] ? {
            id: allEvents[0].id,
            google_account_id: allEvents[0].google_account_id,
            google_calendar_id: allEvents[0].google_calendar_id,
            google_event_id: allEvents[0].google_event_id,
          } : null,
        });
        return NextResponse.json({
          error: 'Failed to save events to database',
          details: upsertError.message,
          code: upsertError.code,
        }, { status: 500 });
      }
    }

    const lastSyncAt = new Date().toISOString();

    const result: SyncResponse = {
      synced: totalSynced,
      deleted: totalDeleted,
      syncToken: '',
      lastSyncAt,
    };

    logger.info('[Calendar Sync] Sync completed', {
      userId: user.id,
      synced: totalSynced,
      deleted: totalDeleted,
      calendarsProcessed: syncedCalendarIds.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[Calendar Sync] Error during sync', {
      error,
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Sync failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

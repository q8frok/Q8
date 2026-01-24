/**
 * Calendar Events API
 *
 * GET /api/calendar/events - Fetch events from Google Calendar
 * POST /api/calendar/events - Create a new event
 * PUT /api/calendar/events - Update an existing event
 * DELETE /api/calendar/events - Delete an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { getGoogleProviderToken, refreshGoogleToken } from '@/lib/auth/google-token';
import { logger } from '@/lib/logger';
import type {
  CalendarEvent,
  CalendarEventInput,
  EventsResponse,
  CreateEventResponse,
  UpdateEventResponse,
  DeleteEventResponse,
} from '@/components/dashboard/widgets/CalendarWidget/types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

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
  organizer?: {
    email: string;
    displayName?: string;
  };
}

/**
 * Helper to get valid access token with auto-refresh
 */
async function getValidAccessToken(): Promise<{ accessToken: string | null; error?: string }> {
  let { accessToken, error } = await getGoogleProviderToken();

  if (!accessToken) {
    logger.info('[Calendar Events] No access token, attempting refresh');
    const refreshResult = await refreshGoogleToken();
    if (refreshResult.accessToken) {
      accessToken = refreshResult.accessToken;
      error = undefined;

      const cookieStore = await cookies();
      cookieStore.set('google_provider_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60,
        path: '/',
      });
    } else {
      error = refreshResult.error;
    }
  }

  return { accessToken, error };
}

/**
 * Transform Google Calendar event to our format
 */
function transformEvent(
  event: GoogleCalendarEvent,
  calendarId: string,
  calendarName: string,
  userId: string
): CalendarEvent {
  // Get meeting URL from various sources
  const meetingUrl =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video'
    )?.uri;

  const isAllDay = !event.start.dateTime;
  const startTime = event.start.dateTime || `${event.start.date}T00:00:00`;
  const endTime = event.end.dateTime || `${event.end.date}T23:59:59`;

  return {
    id: `${calendarId}_${event.id}`,
    user_id: userId,
    title: event.summary || '(No title)',
    description: event.description,
    start_time: startTime,
    end_time: endTime,
    all_day: isAllDay,
    location: event.location,
    meeting_url: meetingUrl,
    attendees: (event.attendees || []).map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: (a.responseStatus || 'needsAction') as 'needsAction' | 'declined' | 'tentative' | 'accepted',
      organizer: a.organizer,
      self: a.self,
      optional: a.optional,
    })),
    color: event.colorId,
    calendar_name: calendarName,
    google_calendar_id: calendarId,
    google_event_id: event.id,
    recurrence: event.recurrence,
    reminders: event.reminders?.overrides?.map((r) => ({
      method: r.method as 'email' | 'popup',
      minutes: r.minutes,
    })),
    status: (event.status || 'confirmed') as 'confirmed' | 'tentative' | 'cancelled',
    visibility: event.visibility as 'default' | 'public' | 'private' | 'confidential',
    created_at: event.created || new Date().toISOString(),
    updated_at: event.updated || new Date().toISOString(),
  };
}

/**
 * GET /api/calendar/events
 *
 * Query params:
 * - calendarIds: Comma-separated calendar IDs (required)
 * - timeMin: ISO date string for start of range
 * - timeMax: ISO date string for end of range
 * - maxResults: Number of results per calendar (default 250)
 * - singleEvents: Expand recurring events (default true)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const calendarIds = searchParams.get('calendarIds')?.split(',') || [];
  const timeMin =
    searchParams.get('timeMin') ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax =
    searchParams.get('timeMax') ||
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const maxResults = parseInt(searchParams.get('maxResults') || '250');
  const singleEvents = searchParams.get('singleEvents') !== 'false';

  if (calendarIds.length === 0) {
    return NextResponse.json(
      { error: 'calendarIds parameter is required' },
      { status: 400 }
    );
  }

  const { accessToken, error: tokenError } = await getValidAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: tokenError || 'Authentication required', authenticated: false },
      { status: 401 }
    );
  }

  try {
    // Fetch events from each calendar in parallel
    const eventsPromises = calendarIds.map(async (calendarId) => {
      try {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: maxResults.toString(),
          singleEvents: singleEvents.toString(),
          orderBy: 'startTime',
        });

        const response = await fetch(
          `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(
            calendarId
          )}/events?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          logger.warn('[Calendar Events] Failed to fetch from calendar', {
            calendarId,
            status: response.status,
          });
          return [];
        }

        const data = await response.json();

        // Get calendar name from the calendar ID (or summary field if available)
        const calendarName = calendarId.includes('@')
          ? calendarId.split('@')[0] ?? calendarId
          : calendarId;

        return (data.items || [])
          .filter((e: GoogleCalendarEvent) => e.status !== 'cancelled')
          .map((event: GoogleCalendarEvent) =>
            transformEvent(event, calendarId, calendarName, user.id)
          );
      } catch (err) {
        logger.warn('[Calendar Events] Error fetching calendar', {
          calendarId,
          error: err,
        });
        return [];
      }
    });

    const allEventsArrays = await Promise.all(eventsPromises);
    const events = allEventsArrays.flat();

    // Sort by start time
    events.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const result: EventsResponse = { events };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[Calendar Events] Error fetching events', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/events
 *
 * Create a new calendar event
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { accessToken, error: tokenError } = await getValidAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: tokenError || 'Authentication required', authenticated: false },
      { status: 401 }
    );
  }

  try {
    const body: CalendarEventInput = await request.json();

    if (!body.title || !body.start_time || !body.end_time || !body.calendar_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title, start_time, end_time, calendar_id' },
        { status: 400 }
      );
    }

    // Build Google Calendar event object
    const googleEvent: Partial<GoogleCalendarEvent> = {
      summary: body.title,
      description: body.description,
      location: body.location,
    };

    // Handle all-day vs timed events
    if (body.all_day) {
      googleEvent.start = { date: body.start_time.split('T')[0] };
      googleEvent.end = { date: body.end_time.split('T')[0] };
    } else {
      googleEvent.start = { dateTime: body.start_time };
      googleEvent.end = { dateTime: body.end_time };
    }

    // Add reminders if specified
    if (body.reminders && body.reminders.length > 0) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: body.reminders.map((r) => ({
          method: r.method,
          minutes: r.minutes,
        })),
      };
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(
        body.calendar_id
      )}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Calendar Events] Failed to create event', {
        status: response.status,
        error: errorText,
      });
      return NextResponse.json(
        { error: `Failed to create event: ${response.status}` },
        { status: response.status }
      );
    }

    const createdEvent: GoogleCalendarEvent = await response.json();

    const event = transformEvent(
      createdEvent,
      body.calendar_id,
      body.calendar_id,
      user.id
    );

    const result: CreateEventResponse = { event };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error('[Calendar Events] Error creating event', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/calendar/events
 *
 * Update an existing calendar event
 *
 * Body: { eventId: string, calendarId: string, updates: Partial<CalendarEventInput> }
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { accessToken, error: tokenError } = await getValidAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: tokenError || 'Authentication required', authenticated: false },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { eventId, calendarId, updates } = body;

    if (!eventId || !calendarId) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, calendarId' },
        { status: 400 }
      );
    }

    // Build update object
    const googleEvent: Partial<GoogleCalendarEvent> = {};

    if (updates.title !== undefined) {
      googleEvent.summary = updates.title;
    }
    if (updates.description !== undefined) {
      googleEvent.description = updates.description;
    }
    if (updates.location !== undefined) {
      googleEvent.location = updates.location;
    }

    if (updates.start_time || updates.end_time) {
      if (updates.all_day) {
        if (updates.start_time) {
          googleEvent.start = { date: updates.start_time.split('T')[0] };
        }
        if (updates.end_time) {
          googleEvent.end = { date: updates.end_time.split('T')[0] };
        }
      } else {
        if (updates.start_time) {
          googleEvent.start = { dateTime: updates.start_time };
        }
        if (updates.end_time) {
          googleEvent.end = { dateTime: updates.end_time };
        }
      }
    }

    if (updates.reminders) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: updates.reminders.map((r: { method: string; minutes: number }) => ({
          method: r.method,
          minutes: r.minutes,
        })),
      };
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Calendar Events] Failed to update event', {
        status: response.status,
        error: errorText,
      });
      return NextResponse.json(
        { error: `Failed to update event: ${response.status}` },
        { status: response.status }
      );
    }

    const updatedEvent: GoogleCalendarEvent = await response.json();

    const event = transformEvent(
      updatedEvent,
      calendarId,
      calendarId,
      user.id
    );

    const result: UpdateEventResponse = { event };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[Calendar Events] Error updating event', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calendar/events
 *
 * Delete a calendar event
 *
 * Query params: eventId, calendarId
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const calendarId = searchParams.get('calendarId');

  if (!eventId || !calendarId) {
    return NextResponse.json(
      { error: 'Missing required params: eventId, calendarId' },
      { status: 400 }
    );
  }

  const { accessToken, error: tokenError } = await getValidAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: tokenError || 'Authentication required', authenticated: false },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 204 or 410 means success (event deleted or already gone)
    if (!response.ok && response.status !== 204 && response.status !== 410) {
      const errorText = await response.text();
      logger.error('[Calendar Events] Failed to delete event', {
        status: response.status,
        error: errorText,
      });
      return NextResponse.json(
        { error: `Failed to delete event: ${response.status}` },
        { status: response.status }
      );
    }

    const result: DeleteEventResponse = { success: true };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[Calendar Events] Error deleting event', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete event' },
      { status: 500 }
    );
  }
}

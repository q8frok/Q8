/**
 * Google Workspace Direct API Tools
 * Calendar, Gmail, and Drive integration for the Secretary agent
 * Assigned to: Secretary Agent (Gemini 3 Flash)
 *
 * Uses @openai/agents tool() for native SDK integration.
 * Auth: getAllGoogleTokens(userId) via RunContext
 */

import { z } from 'zod';
import { tool, type Tool } from '@openai/agents';
import type { RunContext as SDKRunContext } from '@openai/agents';
import { getAllGoogleTokens, type GoogleAccountToken } from '@/lib/auth/google-accounts';
import { createToolError } from '../utils/errors';
import { logger } from '@/lib/logger';
import type { RunContext } from '../runner';

// =============================================================================
// Helpers
// =============================================================================

function getUserId(context?: SDKRunContext<RunContext>): string | null {
  return context?.context?.userId ?? null;
}

async function getTokenWithScope(
  userId: string,
  scopeSubstring: string,
): Promise<GoogleAccountToken | null> {
  const tokens = await getAllGoogleTokens(userId);
  if (tokens.length === 0) {
    logger.warn('[Google Tools] No Google accounts linked for user', { userId });
    return null;
  }
  const match = tokens.find(t => t.scopes.some(s => s.includes(scopeSubstring)));
  if (!match) {
    logger.warn('[Google Tools] No account with required scope', {
      userId,
      requiredScope: scopeSubstring,
      availableScopes: tokens.map(t => ({ email: t.email, scopes: t.scopes })),
    });
  }
  return match ?? null;
}

async function googleApi(
  token: string,
  url: string,
  method = 'GET',
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      logger.error('[Google API] 401 Unauthorized — token expired or revoked', {
        url: url.split('?')[0],
        response: text.slice(0, 300),
      });
      throw new Error(
        'Google API authentication failed. Your access token may have expired. ' +
        'Please re-connect your Google account in Settings → Integrations.'
      );
    }
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.status === 204 ? null : res.json();
}

function noUserContext(): string {
  return JSON.stringify({
    success: false,
    message: 'No user context available. Cannot access Google services.',
  });
}

function noTokenResult(service: string): string {
  return JSON.stringify({
    success: false,
    message: `No Google account linked with ${service} access. Please connect your Google account in Settings.`,
  });
}

// =============================================================================
// google_list_calendars
// =============================================================================

const googleListCalendarsSchema = z.object({});

export const googleListCalendarsTool = tool<typeof googleListCalendarsSchema, RunContext>({
  name: 'google_list_calendars',
  description: 'List all Google calendars from linked Google accounts.',
  parameters: googleListCalendarsSchema,
  execute: async (_args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'calendar');
      if (!token) return noTokenResult('Calendar');

      const data = await googleApi(
        token.accessToken,
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      );

      const items = ((data as Record<string, unknown>).items ?? []) as Array<Record<string, unknown>>;
      const calendars = items.map(c => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary ?? false,
        backgroundColor: c.backgroundColor,
        accessRole: c.accessRole,
      }));

      return JSON.stringify({ success: true, calendars, account: token.email });
    } catch (error) {
      return JSON.stringify(createToolError('google_list_calendars', error));
    }
  },
});

// =============================================================================
// google_list_events
// =============================================================================

const googleListEventsSchema = z.object({
  calendar_id: z.string().default('primary').describe('Calendar ID (default: "primary")'),
  time_min: z.string().nullable().describe('Start of time range as ISO 8601 string. Defaults to now.'),
  time_max: z.string().nullable().describe('End of time range as ISO 8601 string. Defaults to 7 days from now.'),
  max_results: z.number().default(20).describe('Maximum events to return (default: 20)'),
  query: z.string().nullable().describe('Free text search query'),
});

export const googleListEventsTool = tool<typeof googleListEventsSchema, RunContext>({
  name: 'google_list_events',
  description: 'List upcoming calendar events. Can filter by time range and search query.',
  parameters: googleListEventsSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'calendar');
      if (!token) return noTokenResult('Calendar');

      const now = new Date();
      const params = new URLSearchParams({
        timeMin: args.time_min ?? now.toISOString(),
        timeMax: args.time_max ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: args.max_results.toString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      if (args.query) params.set('q', args.query);

      const calendarId = encodeURIComponent(args.calendar_id);
      const data = await googleApi(
        token.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
      );

      const items = ((data as Record<string, unknown>).items ?? []) as Array<Record<string, unknown>>;
      const events = items.map(e => ({
        id: e.id,
        summary: e.summary,
        description: typeof e.description === 'string' ? e.description.slice(0, 200) : undefined,
        start: (e.start as Record<string, unknown>)?.dateTime ?? (e.start as Record<string, unknown>)?.date,
        end: (e.end as Record<string, unknown>)?.dateTime ?? (e.end as Record<string, unknown>)?.date,
        location: e.location,
        status: e.status,
        htmlLink: e.htmlLink,
        attendees: Array.isArray(e.attendees) ? (e.attendees as Array<Record<string, unknown>>).map(a => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })) : undefined,
      }));

      return JSON.stringify({ success: true, events, count: events.length, account: token.email });
    } catch (error) {
      return JSON.stringify(createToolError('google_list_events', error));
    }
  },
});

// =============================================================================
// google_create_event
// =============================================================================

const googleCreateEventSchema = z.object({
  summary: z.string().describe('Event title'),
  description: z.string().nullable().describe('Event description'),
  start_time: z.string().describe('Start time as ISO 8601 string (e.g., "2026-02-07T10:00:00-05:00")'),
  end_time: z.string().describe('End time as ISO 8601 string'),
  location: z.string().nullable().describe('Event location'),
  attendees: z.array(z.string()).nullable().describe('List of attendee email addresses'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default: "primary")'),
});

export const googleCreateEventTool = tool<typeof googleCreateEventSchema, RunContext>({
  name: 'google_create_event',
  description: 'Create a new calendar event with title, time, location, and optional attendees.',
  parameters: googleCreateEventSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'calendar');
      if (!token) return noTokenResult('Calendar');

      const event: Record<string, unknown> = {
        summary: args.summary,
        start: { dateTime: args.start_time },
        end: { dateTime: args.end_time },
      };
      if (args.description) event.description = args.description;
      if (args.location) event.location = args.location;
      if (args.attendees) event.attendees = args.attendees.map(email => ({ email }));

      const calendarId = encodeURIComponent(args.calendar_id);
      const created = await googleApi(
        token.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        'POST',
        event,
      );

      const result = created as Record<string, unknown>;
      return JSON.stringify({
        success: true,
        message: `Event "${args.summary}" created`,
        event: { id: result.id, htmlLink: result.htmlLink },
      });
    } catch (error) {
      return JSON.stringify(createToolError('google_create_event', error));
    }
  },
});

// =============================================================================
// google_update_event
// =============================================================================

const googleUpdateEventSchema = z.object({
  event_id: z.string().describe('Event ID to update'),
  summary: z.string().nullable().describe('New event title'),
  description: z.string().nullable().describe('New event description'),
  start_time: z.string().nullable().describe('New start time as ISO 8601'),
  end_time: z.string().nullable().describe('New end time as ISO 8601'),
  location: z.string().nullable().describe('New location'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default: "primary")'),
});

export const googleUpdateEventTool = tool<typeof googleUpdateEventSchema, RunContext>({
  name: 'google_update_event',
  description: 'Update an existing calendar event. Only specified fields are changed.',
  parameters: googleUpdateEventSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'calendar');
      if (!token) return noTokenResult('Calendar');

      const patch: Record<string, unknown> = {};
      if (args.summary) patch.summary = args.summary;
      if (args.description) patch.description = args.description;
      if (args.start_time) patch.start = { dateTime: args.start_time };
      if (args.end_time) patch.end = { dateTime: args.end_time };
      if (args.location) patch.location = args.location;

      const calendarId = encodeURIComponent(args.calendar_id);
      await googleApi(
        token.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${args.event_id}`,
        'PATCH',
        patch,
      );

      return JSON.stringify({ success: true, message: `Event ${args.event_id} updated` });
    } catch (error) {
      return JSON.stringify(createToolError('google_update_event', error));
    }
  },
});

// =============================================================================
// google_delete_event
// =============================================================================

const googleDeleteEventSchema = z.object({
  event_id: z.string().describe('Event ID to delete'),
  calendar_id: z.string().default('primary').describe('Calendar ID (default: "primary")'),
});

export const googleDeleteEventTool = tool<typeof googleDeleteEventSchema, RunContext>({
  name: 'google_delete_event',
  description: 'Delete a calendar event by its ID.',
  parameters: googleDeleteEventSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'calendar');
      if (!token) return noTokenResult('Calendar');

      const calendarId = encodeURIComponent(args.calendar_id);
      await googleApi(
        token.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${args.event_id}`,
        'DELETE',
      );

      return JSON.stringify({ success: true, message: `Event ${args.event_id} deleted` });
    } catch (error) {
      return JSON.stringify(createToolError('google_delete_event', error));
    }
  },
});

// =============================================================================
// google_list_emails
// =============================================================================

const googleListEmailsSchema = z.object({
  query: z.string().nullable().describe('Gmail search query (e.g., "from:boss@company.com is:unread")'),
  max_results: z.number().default(10).describe('Maximum emails to return (default: 10)'),
  label: z.string().default('INBOX').describe('Gmail label to filter by: INBOX, SENT, DRAFT, TRASH, SPAM, STARRED, or IMPORTANT'),
});

export const googleListEmailsTool = tool<typeof googleListEmailsSchema, RunContext>({
  name: 'google_list_emails',
  description: 'List and search Gmail messages. Supports Gmail search operators.',
  parameters: googleListEmailsSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'mail');
      if (!token) return noTokenResult('Gmail');

      const params = new URLSearchParams({
        maxResults: args.max_results.toString(),
        labelIds: args.label,
      });
      if (args.query) params.set('q', args.query);

      const listData = await googleApi(
        token.accessToken,
        `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
      ) as { messages?: Array<{ id: string }> };

      if (!listData.messages || listData.messages.length === 0) {
        return JSON.stringify({ success: true, emails: [], count: 0 });
      }

      // Fetch message details (batch up to max_results)
      const emails = await Promise.all(
        listData.messages.slice(0, args.max_results).map(async (msg) => {
          const detail = await googleApi(
            token.accessToken,
            `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          ) as { id: string; snippet: string; labelIds: string[]; payload: { headers: Array<{ name: string; value: string }> } };

          const headers = detail.payload?.headers ?? [];
          const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

          return {
            id: detail.id,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            snippet: detail.snippet,
            labels: detail.labelIds,
          };
        }),
      );

      return JSON.stringify({ success: true, emails, count: emails.length, account: token.email });
    } catch (error) {
      return JSON.stringify(createToolError('google_list_emails', error));
    }
  },
});

// =============================================================================
// google_send_email
// =============================================================================

const googleSendEmailSchema = z.object({
  to: z.string().describe('Recipient email address'),
  subject: z.string().describe('Email subject'),
  body: z.string().describe('Email body (plain text)'),
  cc: z.string().nullable().describe('CC recipients (comma-separated)'),
  bcc: z.string().nullable().describe('BCC recipients (comma-separated)'),
});

export const googleSendEmailTool = tool<typeof googleSendEmailSchema, RunContext>({
  name: 'google_send_email',
  description: 'Send an email via Gmail. Provide recipient, subject, and body.',
  parameters: googleSendEmailSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'mail');
      if (!token) return noTokenResult('Gmail');

      // Build RFC 2822 message
      let rawMessage = `To: ${args.to}\r\n`;
      if (args.cc) rawMessage += `Cc: ${args.cc}\r\n`;
      if (args.bcc) rawMessage += `Bcc: ${args.bcc}\r\n`;
      rawMessage += `Subject: ${args.subject}\r\n`;
      rawMessage += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      rawMessage += args.body;

      // Base64url encode
      const encoded = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sent = await googleApi(
        token.accessToken,
        'https://www.googleapis.com/gmail/v1/users/me/messages/send',
        'POST',
        { raw: encoded },
      ) as { id: string };

      return JSON.stringify({
        success: true,
        message: `Email sent to ${args.to}`,
        messageId: sent.id,
      });
    } catch (error) {
      return JSON.stringify(createToolError('google_send_email', error));
    }
  },
});

// =============================================================================
// google_search_drive
// =============================================================================

const googleSearchDriveSchema = z.object({
  query: z.string().describe('Search query for Google Drive files'),
  max_results: z.number().default(10).describe('Maximum results to return (default: 10)'),
  file_type: z.string().default('any').describe('Filter by file type: document, spreadsheet, presentation, pdf, image, or any'),
});

export const googleSearchDriveTool = tool<typeof googleSearchDriveSchema, RunContext>({
  name: 'google_search_drive',
  description: 'Search Google Drive files by name, content, or type.',
  parameters: googleSearchDriveSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const token = await getTokenWithScope(userId, 'drive');
      if (!token) return noTokenResult('Drive');

      const mimeTypes: Record<string, string> = {
        document: 'application/vnd.google-apps.document',
        spreadsheet: 'application/vnd.google-apps.spreadsheet',
        presentation: 'application/vnd.google-apps.presentation',
        pdf: 'application/pdf',
        image: 'image/',
      };

      let q = `name contains '${args.query.replace(/'/g, "\\'")}'`;
      if (args.file_type !== 'any' && mimeTypes[args.file_type]) {
        if (args.file_type === 'image') {
          q += ` and mimeType contains '${mimeTypes[args.file_type]}'`;
        } else {
          q += ` and mimeType = '${mimeTypes[args.file_type]}'`;
        }
      }
      q += ' and trashed = false';

      const params = new URLSearchParams({
        q,
        pageSize: args.max_results.toString(),
        fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,owners)',
        orderBy: 'modifiedTime desc',
      });

      const data = await googleApi(
        token.accessToken,
        `https://www.googleapis.com/drive/v3/files?${params}`,
      ) as { files: Array<Record<string, unknown>> };

      const files = (data.files ?? []).map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        size: f.size,
        webViewLink: f.webViewLink,
      }));

      return JSON.stringify({ success: true, files, count: files.length, account: token.email });
    } catch (error) {
      return JSON.stringify(createToolError('google_search_drive', error));
    }
  },
});

// =============================================================================
// Export all Google tools
// =============================================================================

// Cast needed: tools are typed with RunContext but agents expect Tool<unknown>
// Context flows through at runtime via run()'s context parameter
export const googleTools = [
  googleListCalendarsTool,
  googleListEventsTool,
  googleCreateEventTool,
  googleUpdateEventTool,
  googleDeleteEventTool,
  googleListEmailsTool,
  googleSendEmailTool,
  googleSearchDriveTool,
] as Tool[];

/**
 * Google Workspace MCP Server
 *
 * Provides Gmail, Calendar, Drive tools via MCP protocol.
 * Implements OAuth 2.0 with automatic token refresh.
 *
 * Environment Variables Required:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 * - GOOGLE_REFRESH_TOKEN (obtained after initial OAuth flow)
 */

import express from 'express';
import { google, gmail_v1, calendar_v3, drive_v3 } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// =============================================================================
// OAuth2 Setup
// =============================================================================

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials if refresh token is available
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

// Initialize API clients
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// =============================================================================
// OAuth Routes
// =============================================================================

/**
 * Generate OAuth consent URL
 */
app.get('/auth/url', (_req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  res.json({ authUrl: url });
});

/**
 * Handle OAuth callback and exchange code for tokens
 */
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // In production, store this refresh token securely
    res.json({
      message: 'Authorization successful',
      refreshToken: tokens.refresh_token,
      note: 'Store the refresh token in your .env as GOOGLE_REFRESH_TOKEN',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to exchange code: ${message}` });
  }
});

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS = [
  // Gmail Tools
  {
    name: 'gmail_list_messages',
    description: 'List Gmail messages from inbox or with a search query',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Maximum messages to return (default: 10)' },
        query: { type: 'string', description: 'Gmail search query (e.g., "is:unread", "from:user@example.com")' },
        labelIds: { type: 'array', items: { type: 'string' }, description: 'Filter by label IDs' },
      },
    },
  },
  {
    name: 'gmail_read_message',
    description: 'Read a specific Gmail message by ID',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The Gmail message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'gmail_send_message',
    description: 'Send an email via Gmail',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        cc: { type: 'string', description: 'CC recipients (comma-separated)' },
        bcc: { type: 'string', description: 'BCC recipients (comma-separated)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_search',
    description: 'Search Gmail messages with advanced query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query' },
        maxResults: { type: 'number', description: 'Maximum results (default: 20)' },
      },
      required: ['query'],
    },
  },
  // Calendar Tools
  {
    name: 'calendar_list_events',
    description: 'List upcoming calendar events',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        timeMin: { type: 'string', description: 'Start time (ISO 8601 format)' },
        timeMax: { type: 'string', description: 'End time (ISO 8601 format)' },
        maxResults: { type: 'number', description: 'Maximum events (default: 10)' },
      },
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        summary: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        startTime: { type: 'string', description: 'Start time (ISO 8601 format)' },
        endTime: { type: 'string', description: 'End time (ISO 8601 format)' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
        eventId: { type: 'string', description: 'Event ID to update' },
        summary: { type: 'string', description: 'New event title' },
        description: { type: 'string', description: 'New event description' },
        location: { type: 'string', description: 'New event location' },
        startTime: { type: 'string', description: 'New start time (ISO 8601)' },
        endTime: { type: 'string', description: 'New end time (ISO 8601)' },
      },
      required: ['eventId'],
    },
  },
  // Drive Tools
  {
    name: 'drive_search_files',
    description: 'Search for files in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (file name or content)' },
        mimeType: { type: 'string', description: 'Filter by MIME type (e.g., "application/pdf")' },
        maxResults: { type: 'number', description: 'Maximum results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'drive_read_file',
    description: 'Read metadata and content of a Google Drive file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The Google Drive file ID' },
        exportMimeType: { type: 'string', description: 'Export format for Google Docs (e.g., "text/plain")' },
      },
      required: ['fileId'],
    },
  },
];

app.get('/tools', (_req, res) => {
  res.json(TOOLS);
});

// =============================================================================
// Tool Implementations
// =============================================================================

interface ToolParams {
  // Gmail
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  messageId?: string;
  to?: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
  // Calendar
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  eventId?: string;
  summary?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string[];
  // Drive
  fileId?: string;
  mimeType?: string;
  exportMimeType?: string;
}

async function executeGmailList(params: ToolParams): Promise<gmail_v1.Schema$Message[]> {
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: params.maxResults || 10,
    q: params.query,
    labelIds: params.labelIds,
  });

  const messages = response.data.messages || [];

  // Fetch message details for each message
  const detailed = await Promise.all(
    messages.slice(0, 10).map(async (msg) => {
      if (!msg.id) return null;
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });
      return detail.data;
    })
  );

  return detailed.filter((m): m is gmail_v1.Schema$Message => m !== null);
}

async function executeGmailRead(params: ToolParams): Promise<gmail_v1.Schema$Message> {
  if (!params.messageId) throw new Error('messageId is required');

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: params.messageId,
    format: 'full',
  });

  return response.data;
}

async function executeGmailSend(params: ToolParams): Promise<gmail_v1.Schema$Message> {
  if (!params.to || !params.subject || !params.body) {
    throw new Error('to, subject, and body are required');
  }

  // Build email headers
  const headers = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=utf-8',
  ];

  if (params.cc) headers.push(`Cc: ${params.cc}`);
  if (params.bcc) headers.push(`Bcc: ${params.bcc}`);

  // Create raw email
  const email = `${headers.join('\r\n')}\r\n\r\n${params.body}`;
  const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
    },
  });

  return response.data;
}

async function executeGmailSearch(params: ToolParams): Promise<gmail_v1.Schema$Message[]> {
  if (!params.query) throw new Error('query is required');

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: params.maxResults || 20,
    q: params.query,
  });

  return response.data.messages || [];
}

async function executeCalendarList(params: ToolParams): Promise<calendar_v3.Schema$Event[]> {
  const now = new Date();
  const response = await calendar.events.list({
    calendarId: params.calendarId || 'primary',
    timeMin: params.timeMin || now.toISOString(),
    timeMax: params.timeMax,
    maxResults: params.maxResults || 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

async function executeCalendarCreate(params: ToolParams): Promise<calendar_v3.Schema$Event> {
  if (!params.summary || !params.startTime || !params.endTime) {
    throw new Error('summary, startTime, and endTime are required');
  }

  const event: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: {
      dateTime: params.startTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: params.endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: params.attendees?.map((email) => ({ email })),
  };

  const response = await calendar.events.insert({
    calendarId: params.calendarId || 'primary',
    requestBody: event,
  });

  return response.data;
}

async function executeCalendarUpdate(params: ToolParams): Promise<calendar_v3.Schema$Event> {
  if (!params.eventId) throw new Error('eventId is required');

  // First get the existing event
  const existing = await calendar.events.get({
    calendarId: params.calendarId || 'primary',
    eventId: params.eventId,
  });

  const event: calendar_v3.Schema$Event = {
    ...existing.data,
    summary: params.summary ?? existing.data.summary,
    description: params.description ?? existing.data.description,
    location: params.location ?? existing.data.location,
  };

  if (params.startTime) {
    event.start = {
      dateTime: params.startTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  if (params.endTime) {
    event.end = {
      dateTime: params.endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  const response = await calendar.events.update({
    calendarId: params.calendarId || 'primary',
    eventId: params.eventId,
    requestBody: event,
  });

  return response.data;
}

async function executeDriveSearch(params: ToolParams): Promise<drive_v3.Schema$File[]> {
  if (!params.query) throw new Error('query is required');

  let q = `name contains '${params.query.replace(/'/g, "\\'")}'`;
  if (params.mimeType) {
    q += ` and mimeType='${params.mimeType}'`;
  }

  const response = await drive.files.list({
    q,
    pageSize: params.maxResults || 10,
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
  });

  return response.data.files || [];
}

async function executeDriveRead(params: ToolParams): Promise<{ metadata: drive_v3.Schema$File; content?: string }> {
  if (!params.fileId) throw new Error('fileId is required');

  // Get file metadata
  const metadata = await drive.files.get({
    fileId: params.fileId,
    fields: 'id, name, mimeType, size, modifiedTime, webViewLink, description',
  });

  const result: { metadata: drive_v3.Schema$File; content?: string } = {
    metadata: metadata.data,
  };

  // For Google Docs, Sheets, Slides - export as text
  const mimeType = metadata.data.mimeType;
  if (mimeType?.startsWith('application/vnd.google-apps')) {
    const exportMime = params.exportMimeType || 'text/plain';
    const exported = await drive.files.export({
      fileId: params.fileId,
      mimeType: exportMime,
    });
    result.content = exported.data as string;
  }

  return result;
}

// =============================================================================
// Execute Endpoint
// =============================================================================

app.post('/execute', async (req, res) => {
  const { tool, params } = req.body;

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(401).json({
      error: 'Not authenticated',
      authUrl: '/auth/url',
      message: 'Please complete OAuth flow first',
    });
  }

  try {
    let result: unknown;

    switch (tool) {
      case 'gmail_list_messages':
        result = await executeGmailList(params);
        break;
      case 'gmail_read_message':
        result = await executeGmailRead(params);
        break;
      case 'gmail_send_message':
        result = await executeGmailSend(params);
        break;
      case 'gmail_search':
        result = await executeGmailSearch(params);
        break;
      case 'calendar_list_events':
        result = await executeCalendarList(params);
        break;
      case 'calendar_create_event':
        result = await executeCalendarCreate(params);
        break;
      case 'calendar_update_event':
        result = await executeCalendarUpdate(params);
        break;
      case 'drive_search_files':
        result = await executeDriveSearch(params);
        break;
      case 'drive_read_file':
        result = await executeDriveRead(params);
        break;
      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }

    res.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Tool execution error (${tool}):`, error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Health Check
// =============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    authenticated: !!process.env.GOOGLE_REFRESH_TOKEN,
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Google Workspace MCP Server running on port ${PORT}`);
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    console.log('⚠️  Not authenticated. Visit /auth/url to start OAuth flow.');
  }
});

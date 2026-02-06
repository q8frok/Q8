/**
 * Chat Stream API Route Tests
 *
 * Tests for POST /api/chat/stream covering:
 * - Authentication checks (401 for unauthenticated)
 * - Validation (error event for missing message)
 * - SDK orchestration invocation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { OrchestrationEvent } from '@/lib/agents/orchestration/types';

// Hoisted mock functions that persist across module resets
const {
  mockGetAuthenticatedUser,
  mockExecuteChatStream,
  mockClassifyError,
} = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockExecuteChatStream: vi.fn(),
  mockClassifyError: vi.fn(),
}));

// Mock auth module
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  unauthorizedResponse: () => {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      { status: 401 }
    );
  },
}));

// Mock chat-service (replaces direct SDK mock)
vi.mock('@/lib/agents/sdk/chat-service', () => ({
  executeChatStream: mockExecuteChatStream,
}));

// Mock server-side chat history (prevents supabaseAdmin import at load time)
vi.mock('@/lib/server/chat-history', () => ({
  fetchCanonicalConversationHistory: vi.fn().mockResolvedValue([]),
  fetchThreadMessages: vi.fn().mockResolvedValue([]),
}));

// Mock supabase server (prevents getServerEnv at load time)
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'mock' } }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

// Mock events module
vi.mock('@/lib/agents/sdk/events', () => ({
  EVENT_SCHEMA_VERSION: 1,
}));

// Mock error classifier
vi.mock('@/lib/agents/sdk/utils/errors', () => ({
  classifyError: mockClassifyError,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import route after mocks are set up
import { POST } from '@/app/api/chat/stream/route';

// Helper to create an async generator from events
async function* createEventStream(events: OrchestrationEvent[]): AsyncGenerator<OrchestrationEvent> {
  for (const event of events) {
    yield event;
  }
}

// Helper to parse SSE stream response
async function parseSSEResponse(response: Response): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  const reader = response.body?.getReader();
  if (!reader) return events;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          events.push(JSON.parse(data));
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return events;
}

describe('POST /api/chat/stream', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockEvents: OrchestrationEvent[] = [
    {
      type: 'routing',
      decision: {
        agent: 'orchestrator',
        confidence: 0.95,
        rationale: 'General query',
        source: 'heuristic',
      },
    },
    {
      type: 'agent_start',
      agent: 'orchestrator',
    },
    {
      type: 'content',
      delta: 'Hello! How can I help you?',
    },
    {
      type: 'done',
      fullContent: 'Hello! How can I help you?',
      agent: 'orchestrator',
      threadId: 'thread-abc',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockExecuteChatStream.mockImplementation(() => createEventStream(mockEvents));
    mockClassifyError.mockReturnValue({ code: 'UNKNOWN', recoverable: false });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns error event when message is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200); // SSE streams always return 200
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    const events = await parseSSEResponse(response);
    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toMatchObject({
      type: 'error',
      message: 'Message is required',
    });
  });

  it('uses SDK orchestration', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello Q8' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Wait for the stream to complete
    await parseSSEResponse(response);

    // Chat service should be called
    expect(mockExecuteChatStream).toHaveBeenCalledTimes(1);
  });

  it('passes request signal to SDK streamMessage for cancellation', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello Q8' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    await parseSSEResponse(response);

    expect(mockExecuteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: request.signal,
      })
    );
  });

  it('streams events in SSE format', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello Q8' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    const events = await parseSSEResponse(response);

    // Check we received all expected event types (run_created + run_state + routing + agent_start + run_state + content + done + run_state)
    const types = events.map(e => e.type);
    expect(types).toContain('run_created');
    expect(types).toContain('routing');
    expect(types).toContain('agent_start');
    expect(types).toContain('content');
    expect(types).toContain('done');
  });

  it('passes all parameters to the orchestration service', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Check my PRs',
        threadId: 'thread-123',
        userProfile: {
          name: 'Test User',
          timezone: 'America/New_York',
          communicationStyle: 'concise',
        },
        forceAgent: 'coder',
        showToolExecutions: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    await parseSSEResponse(response);

    expect(mockExecuteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Check my PRs',
        userId: 'user-123',
        threadId: 'thread-123',
        userProfile: expect.objectContaining({
          name: 'Test User',
          timezone: 'America/New_York',
          communicationStyle: 'concise',
        }),
        forceAgent: 'coder',
        showToolExecutions: false,
      })
    );
  });

  it('handles errors from orchestration service gracefully', async () => {
    // Create an async generator that throws
    mockExecuteChatStream.mockImplementation(async function* () {
      throw new Error('LLM service unavailable');
    });

    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200); // SSE always returns 200

    const events = await parseSSEResponse(response);
    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toMatchObject({
      type: 'error',
      message: 'LLM service unavailable',
    });
  });

  it('converts routing event correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const events = await parseSSEResponse(response);

    const routingEvent = events.find((e) => e.type === 'routing');
    expect(routingEvent).toMatchObject({
      type: 'routing',
      agent: 'orchestrator',
      reason: 'General query',
      confidence: 0.95,
      source: 'heuristic',
    });
  });

  it('converts done event correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const events = await parseSSEResponse(response);

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toMatchObject({
      type: 'done',
      fullContent: 'Hello! How can I help you?',
      agent: 'orchestrator',
      threadId: 'thread-abc',
    });
  });

  it('passes forceAgent to SDK as AgentType', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Check my PRs',
        forceAgent: 'coder',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    await parseSSEResponse(response);

    expect(mockExecuteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Check my PRs',
        userId: 'user-123',
        forceAgent: 'coder',
      })
    );
  });
});

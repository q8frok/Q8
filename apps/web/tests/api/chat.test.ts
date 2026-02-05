/**
 * Chat API Route Tests
 *
 * Tests for POST /api/chat covering:
 * - Authentication checks (401 for unauthenticated)
 * - Validation (400 for invalid body)
 * - Successful message processing (200)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { ZodError } from 'zod';

// Hoisted mock functions
const { mockGetAuthenticatedUser, mockProcessMessage } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockProcessMessage: vi.fn(),
}));

// Mock auth module
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  },
}));

// Mock orchestration service
vi.mock('@/lib/agents/orchestration', () => ({
  processMessage: mockProcessMessage,
}));

// Mock validations - re-export the real schemas but mock the error response helper
vi.mock('@/lib/validations', async () => {
  const { z } = await import('zod');
  const { NextResponse } = await import('next/server');

  const chatMessageSchema = z.object({
    message: z.string().min(1, 'Message is required').max(50000),
    userId: z.string().uuid().optional(),
    conversationId: z.string().max(100).optional(),
    userProfile: z
      .object({
        name: z.string().max(100).optional(),
        timezone: z.string().max(50).optional(),
        communicationStyle: z.enum(['concise', 'detailed']).optional(),
      })
      .optional(),
  });

  return {
    chatMessageSchema,
    validationErrorResponse: (error: ZodError) =>
      NextResponse.json(
        { error: 'Validation failed', details: error.flatten() },
        { status: 400 }
      ),
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { POST } from '@/app/api/chat/route';

describe('POST /api/chat', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockResponse = {
    content: 'Hello! How can I help you?',
    agent: 'orchestrator',
    threadId: 'thread-abc',
    routing: {
      agent: 'orchestrator',
      confidence: 0.95,
      rationale: 'General query',
      source: 'router',
    },
    toolExecutions: [],
    memoriesUsed: [],
    citations: [],
    metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockProcessMessage.mockResolvedValue(mockResponse);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when message is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when message is empty string', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 200 with valid message', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello Q8' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe('Hello! How can I help you?');
    expect(body.agent).toBe('orchestrator');
    expect(body.threadId).toBe('thread-abc');
    expect(body.routing).toBeDefined();
    expect(body.routing.confidence).toBe(0.95);
  });

  it('passes userId from authenticated user to processMessage', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(request);

    expect(mockProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hello',
        userId: 'user-123',
      })
    );
  });

  it('passes conversationId and userProfile when provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Check my calendar',
        conversationId: 'conv-456',
        userProfile: {
          name: 'Test User',
          timezone: 'America/New_York',
          communicationStyle: 'concise',
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(request);

    expect(mockProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Check my calendar',
        threadId: 'conv-456',
        userProfile: expect.objectContaining({
          name: 'Test User',
          timezone: 'America/New_York',
        }),
      })
    );
  });

  it('returns 500 when processMessage throws', async () => {
    mockProcessMessage.mockRejectedValue(new Error('LLM service unavailable'));

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to process message');
    expect(body.details).toBe('LLM service unavailable');
  });
});

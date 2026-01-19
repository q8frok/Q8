/**
 * API Route Authentication Protection Tests
 *
 * Tests that all protected API routes properly check authentication
 * and return 401 when not authenticated.
 *
 * This test file focuses on verifying the auth protection pattern
 * rather than testing full route functionality.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth/api-auth';

// Store the original modules
const originalModules: Record<string, unknown> = {};

// Mock the auth module to simulate unauthenticated state
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue(null),
  checkAuthentication: vi.fn().mockResolvedValue({
    authenticated: false,
    error: 'Authentication required. Please sign in.',
  }),
  requireAuth: vi.fn().mockResolvedValue([
    null,
    new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  ]),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

// Mock env for server-side code
vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    GOOGLE_GENERATIVE_AI_KEY: 'test-google-key',
  }),
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
  integrations: {
    plaid: { isConfigured: false, clientId: null, secret: null, env: 'sandbox' },
    snaptrade: { isConfigured: false, clientId: null, consumerKey: null },
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    }),
  },
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

// Mock OpenAI (used in search routes)
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({ data: [{ embedding: [] }] }),
    },
  })),
}));

describe('API Route Authentication Protection', () => {
  // Helper to make a request and check for 401
  async function expectUnauthorized(
    handler: (req: NextRequest) => Promise<Response>,
    url: string,
    options?: { method?: string; body?: string; headers?: Record<string, string> }
  ) {
    const request = new NextRequest(url, options);
    const response = await handler(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    return body;
  }

  describe('Notes API', () => {
    it('GET /api/notes returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/notes/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/notes');
    });

    it('POST /api/notes returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/notes/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  // Note: /api/notes/search uses OpenAI at module level which is difficult to mock in happy-dom
  // The route does use getAuthenticatedUser() for protection

  describe('Memories API', () => {
    it('GET /api/memories returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/memories/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/memories');
    });

    it('POST /api/memories returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/memories/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/memories', {
        method: 'POST',
        body: JSON.stringify({ content: 'Test', memoryType: 'fact' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  // Note: /api/memories/search uses OpenAI at module level which is difficult to mock in happy-dom
  // The route does use getAuthenticatedUser() for protection

  describe('Threads API', () => {
    it('POST /api/threads returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/threads/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/threads', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('Chat API', () => {
    it('POST /api/chat returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/chat/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('Finance APIs', () => {
    it('GET /api/finance/accounts returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/finance/accounts/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/finance/accounts');
    });

    it('POST /api/finance/accounts returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/finance/accounts/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/finance/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Account', type: 'checking' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('GET /api/finance/transactions returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/finance/transactions/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/finance/transactions');
    });

    it('POST /api/finance/transactions returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/finance/transactions/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({ amount: -50, merchantName: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('GET /api/finance/recurring returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/finance/recurring/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/finance/recurring');
    });

    it('GET /api/finance/snapshots returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/finance/snapshots/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/finance/snapshots');
    });

    it('POST /api/finance/sync returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/finance/sync/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/finance/sync', {
        method: 'POST',
      });
    });

    it('POST /api/finance/ai/chat returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/finance/ai/chat/route');
      await expectUnauthorized(POST, 'http://localhost:3000/api/finance/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'What are my expenses?' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('Weather API', () => {
    it('GET /api/weather returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/weather/route');
      await expectUnauthorized(GET, 'http://localhost:3000/api/weather');
    });
  });
});

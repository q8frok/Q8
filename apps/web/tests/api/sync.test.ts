/**
 * Sync API Route Tests
 *
 * Tests for /api/sync/pull and /api/sync/push covering:
 * - RxDB <-> Supabase synchronization
 * - Collection mapping
 * - Data transformation (camelCase <-> snake_case)
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mock functions
const {
  mockRequireAuth,
  mockSupabaseFrom,
  mockSupabaseSelect,
  mockSupabaseUpsert,
  mockSupabaseEq,
  mockSupabaseGte,
  mockSupabaseOrder,
  mockSupabaseLimit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseSelect: vi.fn(),
  mockSupabaseUpsert: vi.fn(),
  mockSupabaseEq: vi.fn(),
  mockSupabaseGte: vi.fn(),
  mockSupabaseOrder: vi.fn(),
  mockSupabaseLimit: vi.fn(),
}));

// Mock auth module
vi.mock('@/lib/auth/api-auth', () => ({
  requireAuth: mockRequireAuth,
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
  },
}));

// Mock error responses
vi.mock('@/lib/api/error-responses', () => ({
  errorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'ERROR', message } },
      { status }
    );
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

// Import after mocks
import { POST as pullPOST } from '@/app/api/sync/pull/route';
import { POST as pushPOST } from '@/app/api/sync/push/route';

describe('Sync API', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  const mockTask = {
    id: 'task-001',
    user_id: 'user-123',
    title: 'Test Task',
    description: 'A test task',
    due_date: '2026-02-10T00:00:00Z',
    priority: 'medium',
    status: 'todo',
    tags: ['work'],
    project_id: null,
    parent_task_id: null,
    sort_order: 0,
    estimated_minutes: 30,
    completed_at: null,
    created_at: '2026-02-04T00:00:00Z',
    updated_at: '2026-02-04T12:00:00Z',
  };

  function setupPullMock(options: {
    selectResult?: { data: unknown[] | null; error: { code?: string; message?: string } | null };
  } = {}) {
    const chain = {
      select: mockSupabaseSelect.mockReturnThis(),
      eq: mockSupabaseEq.mockReturnThis(),
      gte: mockSupabaseGte.mockReturnThis(),
      order: mockSupabaseOrder.mockReturnThis(),
      limit: mockSupabaseLimit.mockImplementation(() => {
        return options.selectResult ?? { data: [mockTask], error: null };
      }),
    };

    mockSupabaseFrom.mockReturnValue(chain);
    return chain;
  }

  function setupPushMock(options: {
    tableCheckResult?: { error: { code?: string; message?: string } | null };
    upsertResult?: { error: { code?: string; message?: string } | null };
  } = {}) {
    const checkChain = {
      select: mockSupabaseSelect.mockReturnThis(),
      limit: mockSupabaseLimit.mockImplementation(() => {
        return options.tableCheckResult ?? { error: null };
      }),
    };

    const upsertChain = {
      upsert: mockSupabaseUpsert.mockImplementation(() => {
        return options.upsertResult ?? { error: null };
      }),
    };

    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      // First call is table check, subsequent calls are upserts
      if (callCount === 1) {
        return checkChain;
      }
      return upsertChain;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue([mockUser, null]);
  });

  describe('POST /api/sync/pull', () => {
    it('returns error response when user is not authenticated', async () => {
      const errorResponse = {
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
      };
      mockRequireAuth.mockResolvedValue([null, errorResponse]);

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 when collection parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/pull', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('Collection');
    });

    it('returns 400 for unknown collection', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=invalid', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('Unknown collection');
    });

    it('pulls documents for valid collection', async () => {
      setupPullMock({
        selectResult: { data: [mockTask], error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.documents).toHaveLength(1);
      expect(body.checkpoint).toBe('2026-02-04T12:00:00Z');
    });

    it('transforms snake_case to camelCase for tasks', async () => {
      setupPullMock({
        selectResult: { data: [mockTask], error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      const body = await response.json();

      expect(body.documents[0].userId).toBe('user-123');
      expect(body.documents[0].dueDate).toBe('2026-02-10T00:00:00Z');
      expect(body.documents[0].sortOrder).toBe(0);
    });

    it('filters by user_id', async () => {
      setupPullMock({
        selectResult: { data: [], error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await pullPOST(request);

      expect(mockSupabaseEq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('filters by lastPulledAt timestamp', async () => {
      setupPullMock({
        selectResult: { data: [], error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-02-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await pullPOST(request);

      expect(mockSupabaseGte).toHaveBeenCalledWith('updated_at', '2026-02-01T00:00:00Z');
    });

    it('respects batchSize parameter', async () => {
      setupPullMock({
        selectResult: { data: [], error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z', batchSize: 50 }),
        headers: { 'Content-Type': 'application/json' },
      });

      await pullPOST(request);

      expect(mockSupabaseLimit).toHaveBeenCalledWith(50);
    });

    it('handles missing table gracefully', async () => {
      setupPullMock({
        selectResult: { data: null, error: { code: '42P01', message: 'table does not exist' } },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.documents).toEqual([]);
    });

    it('returns empty documents with original checkpoint for empty results', async () => {
      setupPullMock({
        selectResult: { data: [], error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/pull?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-02-04T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      const body = await response.json();

      expect(body.documents).toEqual([]);
      expect(body.checkpoint).toBe('2026-02-04T00:00:00Z');
    });
  });

  describe('POST /api/sync/push', () => {
    it('returns error response when user is not authenticated', async () => {
      const errorResponse = {
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
      };
      mockRequireAuth.mockResolvedValue([null, errorResponse]);

      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ documents: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 when collection parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ documents: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 for unknown collection', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=invalid', {
        method: 'POST',
        body: JSON.stringify({ documents: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when documents is not an array', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ documents: 'not-an-array' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('array');
    });

    it('returns empty success for empty documents array', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ documents: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toEqual([]);
      expect(body.errors).toEqual([]);
    });

    it('pushes documents successfully', async () => {
      setupPushMock({
        tableCheckResult: { error: null },
        upsertResult: { error: null },
      });

      const camelCaseTask = {
        id: 'task-001',
        userId: 'user-123',
        title: 'Test Task',
        status: 'todo',
        priority: 'medium',
      };

      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({ documents: [camelCaseTask] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toContain('task-001');
      expect(body.errors).toHaveLength(0);
    });

    it('reports errors for failed upserts', async () => {
      setupPushMock({
        tableCheckResult: { error: null },
        upsertResult: { error: { message: 'Constraint violation' } },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({
          documents: [{ id: 'task-001', title: 'Test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].id).toBe('task-001');
      expect(body.errors[0].error).toContain('Constraint violation');
    });

    it('enforces user_id from authenticated user', async () => {
      setupPushMock({
        tableCheckResult: { error: null },
        upsertResult: { error: null },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({
          documents: [{ id: 'task-001', userId: 'attacker-id', title: 'Test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await pushPOST(request);

      // Verify upsert was called with authenticated user's ID, not attacker's
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123' }),
        { onConflict: 'id' }
      );
    });

    it('handles missing table gracefully', async () => {
      setupPushMock({
        tableCheckResult: { error: { code: '42P01', message: 'table does not exist' } },
      });

      const request = new NextRequest('http://localhost:3000/api/sync/push?collection=tasks', {
        method: 'POST',
        body: JSON.stringify({
          documents: [{ id: 'task-001', title: 'Test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pushPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toEqual([]);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].error).toContain('does not exist');
    });
  });

  describe('Collection mapping', () => {
    const validCollections = [
      'chat_messages',
      'user_preferences',
      'devices',
      'knowledge_base',
      'github_prs',
      'calendar_events',
      'tasks',
    ];

    it.each(validCollections)('accepts valid collection: %s', async (collection) => {
      setupPullMock({
        selectResult: { data: [], error: null },
      });

      const request = new NextRequest(`http://localhost:3000/api/sync/pull?collection=${collection}`, {
        method: 'POST',
        body: JSON.stringify({ lastPulledAt: '2026-01-01T00:00:00Z' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await pullPOST(request);
      expect(response.status).toBe(200);
    });
  });
});

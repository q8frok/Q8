/**
 * Tasks [id] API Route Tests
 *
 * Tests for /api/tasks/[id] covering:
 * - Single task CRUD operations
 * - Authorization checks (ownership verification)
 * - Not found handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mock functions
const { mockGetAuthenticatedUser } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
}));

// Mock results for different operations
let mockSelectResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockUpdateResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockDeleteResult: { error: unknown } = { error: null };

// Create chainable mock
function createChainMock() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => mockSelectResult),
  };

  // Override single based on context
  chain.select = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => mockSelectResult),
  }));

  chain.update = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    select: vi.fn(() => ({
      single: vi.fn(() => mockUpdateResult),
    })),
  }));

  chain.delete = vi.fn(() => ({
    eq: vi.fn(() => mockDeleteResult),
  }));

  return chain;
}

// Mock auth module
vi.mock('@/lib/auth/api-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    );
  },
  forbiddenResponse: (message: string) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message } },
      { status: 403 }
    );
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => createChainMock(),
  },
}));

// Mock validations
vi.mock('@/lib/validations', async () => {
  const { z } = await import('zod');

  const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
  const taskStatusEnum = z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']);

  const updateTaskSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    priority: taskPriorityEnum.optional(),
    status: taskStatusEnum.optional(),
    tags: z.array(z.string().max(50)).max(10).optional().nullable(),
    projectId: z.string().optional().nullable(),
    parentTaskId: z.string().optional().nullable(),
    sortOrder: z.number().optional(),
    estimatedMinutes: z.number().min(1).max(9999).optional().nullable(),
    completedAt: z.string().datetime().optional().nullable(),
  });

  return { updateTaskSchema };
});

// Mock error responses
vi.mock('@/lib/api/error-responses', () => ({
  errorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'ERROR', message } },
      { status }
    );
  },
  notFoundResponse: (resource: string) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `${resource} not found` } },
      { status: 404 }
    );
  },
  validationErrorResponse: (error: { flatten: () => unknown }) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: error.flatten() } },
      { status: 400 }
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
import { GET, PATCH, DELETE } from '@/app/api/tasks/[id]/route';

describe('/api/tasks/[id]', () => {
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
    updated_at: '2026-02-04T00:00:00Z',
  };

  const createParams = (id: string) => ({ params: Promise.resolve({ id }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockSelectResult = { data: mockTask, error: null };
    mockUpdateResult = { data: mockTask, error: null };
    mockDeleteResult = { error: null };
  });

  describe('GET /api/tasks/[id]', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001');
      const response = await GET(request, createParams('task-001'));

      expect(response.status).toBe(401);
    });

    it('returns 404 when task does not exist', async () => {
      mockSelectResult = { data: null, error: { code: 'PGRST116' } };

      const request = new NextRequest('http://localhost:3000/api/tasks/nonexistent');
      const response = await GET(request, createParams('nonexistent'));

      expect(response.status).toBe(404);
    });

    it('returns 403 when task belongs to another user', async () => {
      mockSelectResult = { data: { ...mockTask, user_id: 'user-999' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001');
      const response = await GET(request, createParams('task-001'));

      expect(response.status).toBe(403);
    });

    it('returns task when user owns it', async () => {
      const request = new NextRequest('http://localhost:3000/api/tasks/task-001');
      const response = await GET(request, createParams('task-001'));

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.id).toBe('task-001');
      expect(body.title).toBe('Test Task');
      expect(body.userId).toBe('user-123');
    });

    it('transforms snake_case to camelCase in response', async () => {
      const request = new NextRequest('http://localhost:3000/api/tasks/task-001');
      const response = await GET(request, createParams('task-001'));

      const body = await response.json();
      expect(body.dueDate).toBe('2026-02-10T00:00:00Z');
      expect(body.estimatedMinutes).toBe(30);
      expect(body.sortOrder).toBe(0);
      expect(body.parentTaskId).toBeNull();
    });
  });

  describe('PATCH /api/tasks/[id]', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, createParams('task-001'));
      expect(response.status).toBe(401);
    });

    it('returns 404 when task does not exist', async () => {
      mockSelectResult = { data: null, error: { code: 'PGRST116' } };

      const request = new NextRequest('http://localhost:3000/api/tasks/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, createParams('nonexistent'));
      expect(response.status).toBe(404);
    });

    it('returns 403 when task belongs to another user', async () => {
      mockSelectResult = { data: { user_id: 'user-999' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, createParams('task-001'));
      expect(response.status).toBe(403);
    });

    it('updates task with valid data', async () => {
      mockSelectResult = { data: { user_id: 'user-123' }, error: null };
      mockUpdateResult = { data: { ...mockTask, title: 'Updated Task' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Task' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request, createParams('task-001'));
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/tasks/[id]', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createParams('task-001'));
      expect(response.status).toBe(401);
    });

    it('returns 404 when task does not exist', async () => {
      mockSelectResult = { data: null, error: { code: 'PGRST116' } };

      const request = new NextRequest('http://localhost:3000/api/tasks/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createParams('nonexistent'));
      expect(response.status).toBe(404);
    });

    it('returns 403 when task belongs to another user', async () => {
      mockSelectResult = { data: { user_id: 'user-999' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createParams('task-001'));
      expect(response.status).toBe(403);
    });

    it('deletes task when user owns it', async () => {
      mockSelectResult = { data: { user_id: 'user-123' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/tasks/task-001', {
        method: 'DELETE',
      });

      const response = await DELETE(request, createParams('task-001'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.deleted).toBe('task-001');
    });
  });
});

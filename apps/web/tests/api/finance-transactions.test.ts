/**
 * Finance Transactions API Route Tests
 *
 * Tests for /api/finance/transactions covering:
 * - CRUD operations for financial transactions
 * - Authentication and authorization
 * - Query filters (date range, account)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mock functions
const { mockGetAuthenticatedUser } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
}));

// Mock results
let mockSelectResult: { data: unknown[] | null; error: unknown; count?: number } = {
  data: null,
  error: null,
};
let mockSingleResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockUpdateResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockDeleteResult: { error: unknown } = { error: null };

// Track filter calls
let lastFilters: Map<string, unknown> = new Map();

// Create chainable mock - test utility with complex nested structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChainMock(): any {
  // Build nested chain helpers first
  const orderRangeMock = () => ({
    range: vi.fn(() => mockSelectResult),
  });

  const lteMock = (f2: string, v2: unknown) => {
    lastFilters.set(`${f2}_lte`, v2);
    return { order: vi.fn().mockReturnValue(orderRangeMock()) };
  };

  const gteMock = (f: string, v: unknown) => {
    lastFilters.set(`${f}_gte`, v);
    return {
      lte: vi.fn(lteMock),
      order: vi.fn().mockReturnValue(orderRangeMock()),
    };
  };

  const eqMock = (field: string, value: unknown) => {
    lastFilters.set(field, value);
    return {
      gte: vi.fn(gteMock),
      order: vi.fn().mockReturnValue(orderRangeMock()),
      single: vi.fn(() => mockSingleResult),
    };
  };

  return {
    select: vi.fn(() => ({
      eq: vi.fn(eqMock),
      single: vi.fn(() => mockSingleResult),
    })),
    insert: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        single: vi.fn(() => mockInsertResult),
      }),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn(() => mockUpdateResult),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => mockDeleteResult),
    })),
    eq: vi.fn(eqMock),
    gte: vi.fn(gteMock),
    lte: vi.fn(lteMock),
    order: vi.fn().mockReturnValue(orderRangeMock()),
    range: vi.fn(() => mockSelectResult),
    single: vi.fn(() => mockSingleResult),
  };
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
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => createChainMock(),
  },
}));

// Mock error responses
vi.mock('@/lib/api/error-responses', () => ({
  errorResponse: (message: string, status: number, code?: string) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: { code: code || 'ERROR', message } },
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
import { GET, POST, PUT, DELETE } from '@/app/api/finance/transactions/route';

describe('/api/finance/transactions', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  const mockTransaction = {
    id: 'tx-001',
    user_id: 'user-123',
    account_id: 'acc-001',
    amount: '-50.00',
    date: '2026-02-04',
    datetime: '2026-02-04T12:00:00Z',
    merchant_name: 'Coffee Shop',
    description: 'Morning coffee',
    category: ['Food and Drink', 'Coffee'],
    category_id: null,
    plaid_transaction_id: null,
    is_manual: true,
    is_recurring: false,
    recurring_id: null,
    status: 'posted',
    is_transfer: false,
    transfer_pair_id: null,
    logo_url: null,
    website: null,
    location: null,
    payment_channel: 'in store',
    created_at: '2026-02-04T12:00:00Z',
    updated_at: '2026-02-04T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockSelectResult = { data: [mockTransaction], error: null, count: 1 };
    mockSingleResult = { data: { user_id: 'user-123' }, error: null };
    mockInsertResult = { data: mockTransaction, error: null };
    mockUpdateResult = { data: mockTransaction, error: null };
    mockDeleteResult = { error: null };
    lastFilters = new Map();
  });

  describe('GET /api/finance/transactions', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/finance/transactions');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('returns transactions for authenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.transactions).toHaveLength(1);
      expect(body.transactions[0].merchantName).toBe('Coffee Shop');
    });

    it('transforms snake_case to camelCase', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions');
      const response = await GET(request);

      const body = await response.json();
      expect(body.transactions[0].merchantName).toBe('Coffee Shop');
      expect(body.transactions[0].accountId).toBe('acc-001');
      expect(body.transactions[0].isManual).toBe(true);
      expect(body.transactions[0].isRecurring).toBe(false);
    });

    it('parses amount as number', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions');
      const response = await GET(request);

      const body = await response.json();
      expect(body.transactions[0].amount).toBe(-50);
      expect(typeof body.transactions[0].amount).toBe('number');
    });
  });

  describe('POST /api/finance/transactions', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'acc-001', amount: -50, date: '2026-02-04' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 when required fields are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({ merchantName: 'Coffee Shop' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('required fields');
    });

    it('returns 403 when account does not belong to user', async () => {
      mockSingleResult = { data: { user_id: 'other-user' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'acc-001', amount: -50, date: '2026-02-04' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('creates transaction with valid data', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'acc-001',
          amount: -50,
          date: '2026-02-04',
          merchantName: 'Coffee Shop',
          description: 'Morning coffee',
          category: ['Food and Drink'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.merchantName).toBe('Coffee Shop');
      expect(body.isManual).toBe(true);
    });
  });

  describe('PUT /api/finance/transactions', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'PUT',
        body: JSON.stringify({ id: 'tx-001', amount: -75 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 when transaction ID is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'PUT',
        body: JSON.stringify({ amount: -75 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);
    });

    it('returns 404 when transaction does not exist', async () => {
      mockSingleResult = { data: null, error: { code: 'PGRST116' } };

      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'PUT',
        body: JSON.stringify({ id: 'nonexistent', amount: -75 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      expect(response.status).toBe(404);
    });

    it('returns 403 when transaction belongs to another user', async () => {
      mockSingleResult = { data: { user_id: 'other-user' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'PUT',
        body: JSON.stringify({ id: 'tx-001', amount: -75 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      expect(response.status).toBe(403);
    });

    it('updates transaction with valid data', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'PUT',
        body: JSON.stringify({ id: 'tx-001', amount: -75 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/finance/transactions', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/finance/transactions?id=tx-001', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 when transaction ID is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(400);
    });

    it('returns 404 when transaction does not exist', async () => {
      mockSingleResult = { data: null, error: { code: 'PGRST116' } };

      const request = new NextRequest('http://localhost:3000/api/finance/transactions?id=nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(404);
    });

    it('returns 403 when transaction belongs to another user', async () => {
      mockSingleResult = { data: { user_id: 'other-user' }, error: null };

      const request = new NextRequest('http://localhost:3000/api/finance/transactions?id=tx-001', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });

    it('deletes transaction with valid ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/transactions?id=tx-001', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});

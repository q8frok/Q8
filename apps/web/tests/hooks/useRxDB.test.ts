/**
 * RxDB Hooks Tests
 *
 * Tests for useRxDB and useRxQuery hooks
 * Focuses on testing initialization states and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock data
const mockThread = {
  id: 'thread-1',
  user_id: 'user-1',
  title: 'Test Thread',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  is_archived: false,
};

// Use vi.hoisted to properly hoist the mock function
const { mockGetDatabase } = vi.hoisted(() => {
  return {
    mockGetDatabase: vi.fn(),
  };
});

// Mock the database module
vi.mock('@/lib/db', () => ({
  getDatabase: mockGetDatabase,
}));

// Import hooks after mocking
import { useRxDB, useRxQuery } from '@/hooks/useRxDB';

describe('useRxDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to a default successful database mock
    mockGetDatabase.mockResolvedValue({
      threads: { find: vi.fn() },
      notes: { find: vi.fn() },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useRxDB());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.db).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('resolves database after initialization', async () => {
    const mockDb = {
      threads: { find: vi.fn() },
      notes: { find: vi.fn() },
    };
    mockGetDatabase.mockResolvedValue(mockDb);

    const { result } = renderHook(() => useRxDB());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.db).toBe(mockDb);
    expect(result.current.error).toBe(null);
  });

  it('handles database initialization error', async () => {
    const testError = new Error('Database init failed');
    mockGetDatabase.mockRejectedValue(testError);

    const { result } = renderHook(() => useRxDB());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.db).toBe(null);
    expect(result.current.error).toEqual(testError);
  });

  it('only initializes database once across re-renders', async () => {
    const mockDb = { threads: { find: vi.fn() } };
    mockGetDatabase.mockResolvedValue(mockDb);

    const { result, rerender } = renderHook(() => useRxDB());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender();
    rerender();
    rerender();

    // getDatabase should only be called once due to effect cleanup
    expect(mockGetDatabase).toHaveBeenCalledTimes(1);
  });
});

describe('useRxQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty data and loading state initially', () => {
    mockGetDatabase.mockResolvedValue({
      threads: { find: vi.fn() },
    });

    const { result } = renderHook(() => useRxQuery<typeof mockThread>('threads'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('handles missing collection gracefully', async () => {
    // Database with no 'nonexistent' collection
    mockGetDatabase.mockResolvedValue({
      threads: { find: vi.fn() },
    });

    const { result } = renderHook(() => useRxQuery<unknown>('nonexistent'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should return empty data for missing collection
    expect(result.current.data).toEqual([]);
  });

  it('handles database error gracefully', async () => {
    const testError = new Error('DB connection failed');
    mockGetDatabase.mockRejectedValue(testError);

    const { result } = renderHook(() => useRxQuery<typeof mockThread>('threads'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should return empty data on error
    expect(result.current.data).toEqual([]);
  });

  it('calls find on collection without query builder', async () => {
    const mockFind = vi.fn().mockReturnValue({
      $: {
        subscribe: vi.fn((handlers) => {
          // Emit empty array immediately
          handlers.next([]);
          return { unsubscribe: vi.fn() };
        }),
      },
    });

    mockGetDatabase.mockResolvedValue({
      threads: { find: mockFind },
    });

    const { result } = renderHook(() => useRxQuery<typeof mockThread>('threads'));

    await waitFor(() => {
      expect(mockFind).toHaveBeenCalled();
    });

    expect(result.current.data).toEqual([]);
  });

  it('uses custom query builder when provided', async () => {
    const mockQuery = {
      $: {
        subscribe: vi.fn((handlers) => {
          handlers.next([]);
          return { unsubscribe: vi.fn() };
        }),
      },
    };

    const queryBuilder = vi.fn().mockReturnValue(mockQuery);
    const mockCollection = { find: vi.fn() };

    mockGetDatabase.mockResolvedValue({
      threads: mockCollection,
    });

    renderHook(() => useRxQuery<typeof mockThread>('threads', queryBuilder));

    await waitFor(() => {
      expect(queryBuilder).toHaveBeenCalledWith(mockCollection);
    });
  });

  it('cleans up subscription on unmount', async () => {
    const mockUnsubscribe = vi.fn();
    const mockFind = vi.fn().mockReturnValue({
      $: {
        subscribe: vi.fn(() => ({
          unsubscribe: mockUnsubscribe,
        })),
      },
    });

    mockGetDatabase.mockResolvedValue({
      threads: { find: mockFind },
    });

    const { unmount } = renderHook(() => useRxQuery<typeof mockThread>('threads'));

    await waitFor(() => {
      expect(mockFind).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('useRxQuery data transformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transforms RxDB documents to plain objects', async () => {
    const mockDocs = [
      { toJSON: () => mockThread },
      { toJSON: () => ({ ...mockThread, id: 'thread-2', title: 'Second Thread' }) },
    ];

    const mockFind = vi.fn().mockReturnValue({
      $: {
        subscribe: vi.fn((handlers) => {
          handlers.next(mockDocs);
          return { unsubscribe: vi.fn() };
        }),
      },
    });

    mockGetDatabase.mockResolvedValue({
      threads: { find: mockFind },
    });

    const { result } = renderHook(() => useRxQuery<typeof mockThread>('threads'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    const data = result.current.data;
    expect(data[0]!.id).toBe('thread-1');
    expect(data[0]!.title).toBe('Test Thread');
    expect(data[1]!.id).toBe('thread-2');
    expect(data[1]!.title).toBe('Second Thread');
  });
});

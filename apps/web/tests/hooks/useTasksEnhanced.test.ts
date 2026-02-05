/**
 * useTasksEnhanced Hook Tests
 *
 * Tests for the enhanced tasks hook covering:
 * - Initial state (empty tasks, loading)
 * - Error state exposure (lastError, clearError)
 * - Collection-absent guard (returns null/false gracefully)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Hoisted mock for useRxCollection
const { mockUseRxCollection } = vi.hoisted(() => ({
  mockUseRxCollection: vi.fn(),
}));

// Mock rxdb-hooks
vi.mock('rxdb-hooks', () => ({
  useRxCollection: mockUseRxCollection,
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

import { useTasksEnhanced } from '@/hooks/useTasksEnhanced';

describe('useTasksEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty tasks array and loading state initially when collection is null', () => {
    mockUseRxCollection.mockReturnValue(null);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    expect(result.current.tasks).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.lastError).toBeNull();
  });

  it('exposes lastError as null initially', () => {
    mockUseRxCollection.mockReturnValue(null);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    expect(result.current.lastError).toBeNull();
  });

  it('exposes clearError that resets lastError to null', async () => {
    // Create a collection mock that will cause an error on createTask
    const mockCollection = {
      find: vi.fn().mockReturnValue({
        $: {
          subscribe: vi.fn((callback: (docs: unknown[]) => void) => {
            callback([]);
            return { unsubscribe: vi.fn() };
          }),
        },
      }),
      insert: vi.fn().mockRejectedValue(new Error('Insert failed')),
    };
    mockUseRxCollection.mockReturnValue(mockCollection);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    // Trigger an error by calling createTask
    await act(async () => {
      await result.current.createTask({
        title: 'Test',
        status: 'todo',
        priority: 'medium',
        tags: [],
        ai_generated: false,
      });
    });

    // lastError should now be set
    expect(result.current.lastError).toBeInstanceOf(Error);
    expect(result.current.lastError?.message).toBe('Insert failed');

    // clearError should reset it
    act(() => {
      result.current.clearError();
    });

    expect(result.current.lastError).toBeNull();
  });

  it('subscribes to collection and updates tasks when docs arrive', async () => {
    const mockDocs = [
      {
        toJSON: () => ({
          id: 'task-1',
          user_id: 'user-1',
          title: 'Test Task',
          status: 'todo',
          priority: 'medium',
          tags: [],
          ai_generated: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }),
      },
    ];

    const mockCollection = {
      find: vi.fn().mockReturnValue({
        $: {
          subscribe: vi.fn((callback: (docs: unknown[]) => void) => {
            callback(mockDocs);
            return { unsubscribe: vi.fn() };
          }),
        },
      }),
    };
    mockUseRxCollection.mockReturnValue(mockCollection);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]?.title).toBe('Test Task');
  });

  it('createTask returns null when collection is not available', async () => {
    mockUseRxCollection.mockReturnValue(null);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    let created: unknown;
    await act(async () => {
      created = await result.current.createTask({
        title: 'Test',
        status: 'todo',
        priority: 'medium',
        tags: [],
        ai_generated: false,
      });
    });

    expect(created).toBeNull();
  });

  it('updateTask returns false when collection is not available', async () => {
    mockUseRxCollection.mockReturnValue(null);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateTask('task-1', { title: 'Updated' });
    });

    expect(updated).toBe(false);
  });

  it('deleteTask returns false when collection is not available', async () => {
    mockUseRxCollection.mockReturnValue(null);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteTask('task-1');
    });

    expect(deleted).toBe(false);
  });

  it('sets lastError when createTask fails', async () => {
    const mockCollection = {
      find: vi.fn().mockReturnValue({
        $: {
          subscribe: vi.fn((callback: (docs: unknown[]) => void) => {
            callback([]);
            return { unsubscribe: vi.fn() };
          }),
        },
      }),
      insert: vi.fn().mockRejectedValue(new Error('Database write error')),
    };
    mockUseRxCollection.mockReturnValue(mockCollection);

    const { result } = renderHook(() => useTasksEnhanced('user-1'));

    await act(async () => {
      await result.current.createTask({
        title: 'Failing task',
        status: 'todo',
        priority: 'low',
        tags: [],
        ai_generated: false,
      });
    });

    expect(result.current.lastError).toBeInstanceOf(Error);
    expect(result.current.lastError?.message).toBe('Database write error');
  });

  it('unsubscribes on unmount', () => {
    const mockUnsubscribe = vi.fn();
    const mockCollection = {
      find: vi.fn().mockReturnValue({
        $: {
          subscribe: vi.fn(() => ({
            unsubscribe: mockUnsubscribe,
          })),
        },
      }),
    };
    mockUseRxCollection.mockReturnValue(mockCollection);

    const { unmount } = renderHook(() => useTasksEnhanced('user-1'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

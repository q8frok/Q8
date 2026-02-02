'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import type { Task, TaskFilters, TaskStatus } from '../types';

interface UseTaskDataOptions {
  filters?: TaskFilters;
  limit?: number;
  parentTaskId?: string | null;
}

interface UseTaskDataReturn {
  tasks: Task[];
  tasksByStatus: Record<TaskStatus, Task[]>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  taskCounts: {
    all: number;
    today: number;
    overdue: number;
    thisWeek: number;
    byStatus: Record<TaskStatus, number>;
  };
}

export function useTaskData(options: UseTaskDataOptions = {}): UseTaskDataReturn {
  const { filters, limit = 50, parentTaskId } = options;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();

    if (filters?.status && filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }

    if (limit) {
      params.set('limit', limit.toString());
    }

    if (parentTaskId === null) {
      params.set('parentTaskId', 'null');
    } else if (parentTaskId) {
      params.set('parentTaskId', parentTaskId);
    }

    return params.toString();
  }, [filters?.status, limit, parentTaskId]);

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setRawTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = queryParams ? `/api/tasks?${queryParams}` : '/api/tasks';
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const data = await response.json();
      setRawTasks(data.tasks || []);
    } catch (err) {
      logger.error('Error fetching tasks', { error: err });
      setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
      setRawTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading, queryParams]);

  // Initial fetch and refetch on dependency changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Apply client-side filters that aren't supported by API
  const tasks = useMemo(() => {
    if (!rawTasks) return [];

    let filtered = [...rawTasks];

    // Filter for top-level tasks (no parent) - handles both null and undefined
    if (parentTaskId === null) {
      filtered = filtered.filter((task) => !task.parentTaskId);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.priority && filters.priority.length > 0) {
      filtered = filtered.filter((task) =>
        filters.priority!.includes(task.priority)
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      filtered = filtered.filter((task) =>
        filters.tags!.some((tag) => task.tags?.includes(tag))
      );
    }

    if (filters?.dueDateRange) {
      const { start, end } = filters.dueDateRange;
      filtered = filtered.filter((task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        if (start && dueDate < new Date(start)) return false;
        if (end && dueDate > new Date(end)) return false;
        return true;
      });
    }

    // Sort by sortOrder
    filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return filtered;
  }, [rawTasks, filters, parentTaskId]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    Object.keys(grouped).forEach((status) => {
      grouped[status as TaskStatus].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });

    return grouped;
  }, [tasks]);

  const taskCounts = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const activeTasks = tasks.filter((t) => t.status !== 'done');

    return {
      all: tasks.length,
      today: activeTasks.filter((task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate < endOfToday;
      }).length,
      overdue: activeTasks.filter((task) => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) < today;
      }).length,
      thisWeek: activeTasks.filter((task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate < endOfWeek;
      }).length,
      byStatus: {
        backlog: tasksByStatus.backlog.length,
        todo: tasksByStatus.todo.length,
        in_progress: tasksByStatus.in_progress.length,
        review: tasksByStatus.review.length,
        done: tasksByStatus.done.length,
      },
    };
  }, [tasks, tasksByStatus]);

  return {
    tasks,
    tasksByStatus,
    isLoading,
    error,
    refetch: fetchTasks,
    taskCounts,
  };
}

export function useSubtasks(parentTaskId: string) {
  return useTaskData({ parentTaskId });
}

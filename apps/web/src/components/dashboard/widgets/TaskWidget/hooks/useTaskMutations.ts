'use client';

import { useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import type { Task, TaskStatus, TaskPriority } from '../types';

interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
  projectId?: string;
  parentTaskId?: string;
  estimatedMinutes?: number;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  tags?: string[];
  projectId?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  estimatedMinutes?: number | null;
  completedAt?: string | null;
}

// Event emitter for task updates
type TaskUpdateListener = () => void;
const taskUpdateListeners = new Set<TaskUpdateListener>();

export function onTaskUpdate(listener: TaskUpdateListener) {
  taskUpdateListeners.add(listener);
  return () => taskUpdateListeners.delete(listener);
}

function notifyTaskUpdate() {
  taskUpdateListeners.forEach((listener) => listener());
}

export function useTaskMutations() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isReady = !authLoading && isAuthenticated;

  // Keep track of pending operations to avoid double-submits
  const pendingOps = useRef(new Set<string>());

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      if (!isReady) {
        logger.error('Cannot create task: not authenticated');
        return null;
      }

      const opKey = `create-${input.title}`;
      if (pendingOps.current.has(opKey)) return null;
      pendingOps.current.add(opKey);

      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: input.title,
            description: input.description,
            status: input.status || 'todo',
            priority: input.priority || 'medium',
            dueDate: input.dueDate,
            tags: input.tags || [],
            projectId: input.projectId,
            parentTaskId: input.parentTaskId,
            estimatedMinutes: input.estimatedMinutes,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create task');
        }

        const data = await response.json();
        logger.info('Task created', { taskId: data.id });
        notifyTaskUpdate();
        return data;
      } catch (error) {
        logger.error('Failed to create task', { error });
        return null;
      } finally {
        pendingOps.current.delete(opKey);
      }
    },
    [isReady]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: UpdateTaskInput): Promise<Task | null> => {
      if (!isReady) {
        logger.error('Cannot update task: not authenticated');
        return null;
      }

      const opKey = `update-${taskId}`;
      if (pendingOps.current.has(opKey)) return null;
      pendingOps.current.add(opKey);

      try {
        const response = await fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, ...updates }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update task');
        }

        const data = await response.json();
        logger.info('Task updated', { taskId });
        notifyTaskUpdate();
        return data.task;
      } catch (error) {
        logger.error('Failed to update task', { error, taskId });
        return null;
      } finally {
        pendingOps.current.delete(opKey);
      }
    },
    [isReady]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!isReady) {
        logger.error('Cannot delete task: not authenticated');
        return false;
      }

      const opKey = `delete-${taskId}`;
      if (pendingOps.current.has(opKey)) return false;
      pendingOps.current.add(opKey);

      try {
        const response = await fetch(`/api/tasks?id=${taskId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete task');
        }

        logger.info('Task deleted', { taskId });
        notifyTaskUpdate();
        return true;
      } catch (error) {
        logger.error('Failed to delete task', { error, taskId });
        return false;
      } finally {
        pendingOps.current.delete(opKey);
      }
    },
    [isReady]
  );

  const moveTask = useCallback(
    async (
      taskId: string,
      newStatus: TaskStatus,
      newIndex: number,
      tasksInColumn: Task[]
    ): Promise<boolean> => {
      if (!isReady) {
        logger.error('Cannot move task: not authenticated');
        return false;
      }

      try {
        // Calculate new sort order
        let newSortOrder: number;

        if (tasksInColumn.length === 0) {
          newSortOrder = 1000;
        } else if (newIndex === 0) {
          const firstTask = tasksInColumn[0];
          newSortOrder = firstTask ? (firstTask.sortOrder || 1000) - 1000 : 1000;
        } else if (newIndex >= tasksInColumn.length) {
          const lastTask = tasksInColumn[tasksInColumn.length - 1];
          newSortOrder = lastTask ? (lastTask.sortOrder || 0) + 1000 : 1000;
        } else {
          const prevTask = tasksInColumn[newIndex - 1];
          const nextTask = tasksInColumn[newIndex];
          const prevOrder = prevTask?.sortOrder ?? 0;
          const nextOrder = nextTask?.sortOrder ?? prevOrder + 2000;
          newSortOrder = Math.floor((prevOrder + nextOrder) / 2);
        }

        const result = await updateTask(taskId, {
          status: newStatus,
          sortOrder: newSortOrder,
        });

        return result !== null;
      } catch (error) {
        logger.error('Failed to move task', { error, taskId });
        return false;
      }
    },
    [isReady, updateTask]
  );

  const toggleTaskStatus = useCallback(
    async (task: Task): Promise<Task | null> => {
      const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
      return updateTask(task.id, { status: newStatus });
    },
    [updateTask]
  );

  const bulkUpdateStatus = useCallback(
    async (taskIds: string[], status: TaskStatus): Promise<boolean> => {
      if (!isReady) return false;

      try {
        const results = await Promise.all(
          taskIds.map((id) => updateTask(id, { status }))
        );
        return results.every((r) => r !== null);
      } catch (error) {
        logger.error('Failed bulk status update', { error });
        return false;
      }
    },
    [isReady, updateTask]
  );

  const bulkDelete = useCallback(
    async (taskIds: string[]): Promise<boolean> => {
      if (!isReady) return false;

      try {
        const results = await Promise.all(
          taskIds.map((id) => deleteTask(id))
        );
        return results.every((r) => r);
      } catch (error) {
        logger.error('Failed bulk delete', { error });
        return false;
      }
    },
    [isReady, deleteTask]
  );

  return {
    isReady,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    toggleTaskStatus,
    bulkUpdateStatus,
    bulkDelete,
  };
}

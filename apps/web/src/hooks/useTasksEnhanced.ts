'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRxCollection } from 'rxdb-hooks';
import { logger } from '@/lib/logger';
import type { TaskEnhanced, TaskTag } from '@/lib/db/schemas/tasks-enhanced';

export function useTasksEnhanced(userId: string, parentTaskId?: string | null) {
  const collection = useRxCollection<TaskEnhanced>('tasks');
  const [tasks, setTasks] = useState<TaskEnhanced[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!collection) return;

    const selector: Record<string, any> = {
      user_id: userId,
      deleted_at: { $exists: false },
    };

    if (parentTaskId === null) {
      selector.parent_task_id = { $exists: false };
    } else if (parentTaskId) {
      selector.parent_task_id = parentTaskId;
    }

    const subscription = collection
      .find({ selector })
      .$.subscribe((docs) => {
        setTasks(docs.map((doc) => doc.toJSON() as TaskEnhanced));
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [collection, userId, parentTaskId]);

  const createTask = useCallback(
    async (task: Omit<TaskEnhanced, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!collection) return null;

      try {
        const now = new Date().toISOString();
        const doc = await collection.insert({
          id: crypto.randomUUID(),
          user_id: userId,
          ...task,
          tags: task.tags || [],
          ai_generated: task.ai_generated || false,
          created_at: now,
          updated_at: now,
        });

        return doc.toJSON() as TaskEnhanced;
      } catch (error) {
        logger.error('Failed to create task', { error });
        return null;
      }
    },
    [collection, userId]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<TaskEnhanced>) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(id).exec();
        if (!doc) return false;

        await doc.update({
          $set: {
            ...updates,
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to update task', { error });
        return false;
      }
    },
    [collection]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(id).exec();
        if (!doc) return false;

        await doc.update({
          $set: {
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to delete task', { error });
        return false;
      }
    },
    [collection]
  );

  const addSubtask = useCallback(
    async (parentId: string, subtask: Omit<TaskEnhanced, 'id' | 'user_id' | 'parent_task_id' | 'created_at' | 'updated_at'>) => {
      return createTask({
        ...subtask,
        parent_task_id: parentId,
      });
    },
    [createTask]
  );

  const addTag = useCallback(
    async (taskId: string, tag: string) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(taskId).exec();
        if (!doc) return false;

        const currentTags = doc.get('tags') || [];
        if (currentTags.includes(tag)) return true;

        await doc.update({
          $set: {
            tags: [...currentTags, tag],
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to add tag', { error });
        return false;
      }
    },
    [collection]
  );

  const removeTag = useCallback(
    async (taskId: string, tag: string) => {
      if (!collection) return false;

      try {
        const doc = await collection.findOne(taskId).exec();
        if (!doc) return false;

        const currentTags = doc.get('tags') || [];
        await doc.update({
          $set: {
            tags: currentTags.filter((t: string) => t !== tag),
            updated_at: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        logger.error('Failed to remove tag', { error });
        return false;
      }
    },
    [collection]
  );

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    addSubtask,
    addTag,
    removeTag,
  };
}

export function useTaskTags(userId: string) {
  const collection = useRxCollection<TaskTag>('task_tags');
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!collection) return;

    const fetchTags = async () => {
      try {
        const docs = await collection
          .find({
            selector: { user_id: userId },
            sort: [{ name: 'asc' }],
          })
          .exec();

        setTags(docs.map((doc) => doc.toJSON() as TaskTag));
      } catch (error) {
        logger.error('Failed to fetch tags', { error });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();

    const subscription = collection
      .find({ selector: { user_id: userId } })
      .$.subscribe((docs) => {
        setTags(docs.map((doc) => doc.toJSON() as TaskTag));
      });

    return () => subscription.unsubscribe();
  }, [collection, userId]);

  const createTag = useCallback(
    async (name: string, color: string = '#8B5CF6') => {
      if (!collection) return null;

      try {
        const now = new Date().toISOString();
        const doc = await collection.insert({
          id: crypto.randomUUID(),
          user_id: userId,
          name,
          color,
          created_at: now,
          updated_at: now,
        });

        return doc.toJSON() as TaskTag;
      } catch (error) {
        logger.error('Failed to create tag', { error });
        return null;
      }
    },
    [collection, userId]
  );

  return {
    tags,
    isLoading,
    createTag,
  };
}

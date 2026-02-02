'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { useOptionalWidgetUpdates } from '@/contexts/WidgetUpdateContext';
import { onTaskUpdate } from '@/components/dashboard/widgets/TaskWidget/hooks/useTaskMutations';
import type { BriefTask, BriefTasksData, LegacyTasksData, UseBriefTasksReturn } from '../types';
import { isLegacyTasksData } from '../types';

/**
 * Normalize legacy string[] tasks into BriefTask[] format
 */
function normalizeLegacyTasks(titles: string[], isUrgent: boolean): BriefTask[] {
  return titles.map((title, i) => ({
    id: `legacy-${isUrgent ? 'urgent' : 'today'}-${i}`,
    title,
    status: 'todo',
    priority: isUrgent ? 'high' : 'medium',
    isUrgent,
  }));
}

/**
 * Hook to manage live task data for the daily brief.
 * Handles both legacy (string[]) and new (BriefTask[]) formats.
 * Syncs with TaskWidget via onTaskUpdate listener and WidgetUpdateContext.
 */
export function useBriefTasks(
  briefTasks: BriefTasksData | LegacyTasksData | undefined
): UseBriefTasksReturn {
  const { pushUpdate } = useOptionalWidgetUpdates();
  const [liveTasks, setLiveTasks] = useState<BriefTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Determine if we have new-format tasks with real IDs
  const isLegacy = !briefTasks || isLegacyTasksData(briefTasks);

  // Extract task IDs for fetching live data
  const taskIds = useMemo(() => {
    if (!briefTasks || isLegacy) return [];
    const data = briefTasks as BriefTasksData;
    return [...data.urgent, ...data.today]
      .map((t) => t.id)
      .filter((id) => !id.startsWith('legacy-'));
  }, [briefTasks, isLegacy]);

  // Fetch live task status from API
  const fetchLiveTasks = useCallback(async () => {
    if (taskIds.length === 0) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      taskIds.forEach((id) => params.append('ids', id));

      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) return;

      const data = await response.json();
      const apiTasks = data.tasks || [];

      // Merge API data with brief task metadata
      setLiveTasks((prev) => {
        const taskMap = new Map(apiTasks.map((t: BriefTask) => [t.id, t]));
        return prev.map((t) => {
          const live = taskMap.get(t.id);
          if (live) {
            return { ...t, status: (live as BriefTask).status, title: (live as BriefTask).title };
          }
          return t;
        });
      });
    } catch (err) {
      logger.error('Failed to fetch live brief tasks', { error: err });
    } finally {
      setIsLoading(false);
    }
  }, [taskIds]);

  // Initialize tasks from brief data
  useEffect(() => {
    if (!briefTasks) {
      setLiveTasks([]);
      return;
    }

    if (isLegacy) {
      const legacy = briefTasks as LegacyTasksData;
      setLiveTasks([
        ...normalizeLegacyTasks(legacy.urgent, true),
        ...normalizeLegacyTasks(legacy.today, false),
      ]);
    } else {
      const data = briefTasks as BriefTasksData;
      setLiveTasks([...data.urgent, ...data.today]);
      // Fetch live status for non-legacy tasks
      fetchLiveTasks();
    }
  }, [briefTasks, isLegacy, fetchLiveTasks]);

  // Listen for task updates from TaskWidget
  useEffect(() => {
    if (taskIds.length === 0) return;
    const unsubscribe = onTaskUpdate(() => {
      fetchLiveTasks();
    });
    return () => { unsubscribe(); };
  }, [taskIds, fetchLiveTasks]);

  // Toggle a task's completion status
  const toggleTask = useCallback(
    async (taskId: string) => {
      if (taskId.startsWith('legacy-')) return; // Can't toggle legacy tasks

      const task = liveTasks.find((t) => t.id === taskId);
      if (!task) return;

      const newStatus = task.status === 'done' ? 'todo' : 'done';

      // Optimistic update
      setLiveTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            completedAt: newStatus === 'done' ? new Date().toISOString() : null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update task');
        }

        // Notify TaskWidget to refresh
        pushUpdate({ widgetId: 'tasks', action: 'refresh' });
      } catch (err) {
        // Revert optimistic update
        setLiveTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
        );
        logger.error('Failed to toggle task in brief', { taskId, error: err });
      }
    },
    [liveTasks, pushUpdate]
  );

  const urgentTasks = useMemo(() => liveTasks.filter((t) => t.isUrgent), [liveTasks]);
  const todayTasks = useMemo(() => liveTasks.filter((t) => !t.isUrgent), [liveTasks]);

  return {
    tasks: liveTasks,
    urgentTasks,
    todayTasks,
    isLoading,
    toggleTask,
    refetch: fetchLiveTasks,
  };
}

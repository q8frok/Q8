'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useWidgetSubscription } from '@/contexts/WidgetUpdateContext';
import { BRIEF_CONFIG } from '../constants';
import type { DailyBriefContent, UseBriefDataReturn } from '../types';

export function useBriefData(userId: string): UseBriefDataReturn {
  const [brief, setBrief] = useState<DailyBriefContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshKey } = useWidgetSubscription('daily-brief');

  const fetchBrief = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/briefs/latest');
      if (!response.ok) {
        throw new Error(`Failed to fetch brief: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.brief) {
        setBrief(data.brief);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch brief';
      logger.error('Failed to fetch daily brief', { error: err });
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const regenerateBrief = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetch('/api/cron/morning-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to regenerate: ${res.statusText}`);
      }

      // Fetch the newly generated brief
      await fetchBrief(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate brief';
      logger.error('Failed to regenerate brief', { error: err });
      setError(msg);
      setIsRefreshing(false);
    }
  }, [fetchBrief]);

  // Check if brief needs regeneration (missing new fields)
  const needsRegeneration = brief ? !brief.quickActions || !brief.insights : false;

  // Initial fetch
  useEffect(() => {
    fetchBrief();
  }, [fetchBrief, userId]);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBrief(true);
    }, BRIEF_CONFIG.REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchBrief]);

  // Refresh when triggered externally via WidgetUpdateContext
  useEffect(() => {
    if (refreshKey > 0) {
      fetchBrief(true);
    }
  }, [refreshKey, fetchBrief]);

  return {
    brief,
    isLoading,
    isRefreshing,
    error,
    fetchBrief,
    regenerateBrief,
    needsRegeneration,
  };
}

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  DISMISSED_INSIGHTS_KEY,
  DISMISSAL_EXPIRY_DAYS,
  MAX_DISMISSED_RECORDS,
} from '../constants';
import type { Insight, UseDismissedInsightsReturn } from '../types';

interface DismissalRecord {
  id: string;
  dismissedAt: number;
}

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    if (!stored) return new Set();

    const records: DismissalRecord[] = JSON.parse(stored);
    const now = Date.now();
    const expiryMs = DISMISSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const validRecords = records.filter((r) => now - r.dismissedAt < expiryMs);

    if (validRecords.length !== records.length) {
      localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(validRecords));
    }

    return new Set(validRecords.map((r) => r.id));
  } catch {
    return new Set();
  }
}

function persistDismissal(insightId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    const records: DismissalRecord[] = stored ? JSON.parse(stored) : [];

    if (records.some((r) => r.id === insightId)) return;

    records.push({ id: insightId, dismissedAt: Date.now() });
    const trimmed = records.slice(-MAX_DISMISSED_RECORDS);

    localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

export function useDismissedInsights(): UseDismissedInsightsReturn {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadDismissedIds());

  const dismissInsight = useCallback((id: string) => {
    persistDismissal(id);
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const filterInsights = useCallback(
    (insights: Insight[]) => insights.filter((i) => !dismissedIds.has(i.id)),
    [dismissedIds]
  );

  return useMemo(
    () => ({ dismissedIds, dismissInsight, filterInsights }),
    [dismissedIds, dismissInsight, filterInsights]
  );
}

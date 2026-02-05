'use client';

import { useState, useCallback, useMemo } from 'react';
import type { CompactView } from '../types';

export interface UseCalendarNavigationReturn {
  compactView: CompactView;
  setCompactView: (view: CompactView) => void;
  compactDate: Date;
  compactDateLabel: string;
  compactStartDate: Date;
  compactEndDate: Date;
  todayEndDate: Date;
  handleCompactPrev: () => void;
  handleCompactNext: () => void;
  handleCompactToday: () => void;
}

/**
 * Manages compact view selection and date navigation state
 * for the CalendarWidget.
 */
export function useCalendarNavigation(
  defaultView: CompactView = 'upcoming'
): UseCalendarNavigationReturn {
  const [compactView, setCompactView] = useState<CompactView>(defaultView);
  const [compactDate, setCompactDate] = useState<Date>(new Date());

  // Compact date label
  const compactDateLabel = useMemo(() => {
    const today = new Date();
    const isToday =
      compactDate.getFullYear() === today.getFullYear() &&
      compactDate.getMonth() === today.getMonth() &&
      compactDate.getDate() === today.getDate();
    if (isToday) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      compactDate.getFullYear() === tomorrow.getFullYear() &&
      compactDate.getMonth() === tomorrow.getMonth() &&
      compactDate.getDate() === tomorrow.getDate();
    if (isTomorrow) return 'Tomorrow';
    return compactDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [compactDate]);

  const handleCompactPrev = useCallback(() => {
    setCompactDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const handleCompactNext = useCallback(() => {
    setCompactDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const handleCompactToday = useCallback(() => {
    setCompactDate(new Date());
  }, []);

  // Date range for compact view filtering (7-day window)
  const compactStartDate = useMemo(() => {
    const d = new Date(compactDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [compactDate]);

  const compactEndDate = useMemo(() => {
    const d = new Date(compactDate);
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [compactDate]);

  // End of the selected compact date (for today-only filtering)
  const todayEndDate = useMemo(() => {
    const d = new Date(compactDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [compactDate]);

  return {
    compactView,
    setCompactView,
    compactDate,
    compactDateLabel,
    compactStartDate,
    compactEndDate,
    todayEndDate,
    handleCompactPrev,
    handleCompactNext,
    handleCompactToday,
  };
}

export default useCalendarNavigation;

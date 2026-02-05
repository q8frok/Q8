'use client';

import { memo } from 'react';
import {
  Calendar,
  Settings,
  Maximize2,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SyncStatus } from './SyncStatus';
import { COMPACT_VIEWS } from '../constants';
import type { CompactView } from '../types';

export interface CalendarWidgetHeaderProps {
  isAuthenticated: boolean;
  isSyncing: boolean;
  compactView: CompactView;
  compactDateLabel: string;
  onCompactViewChange: (view: CompactView) => void;
  onSync: () => void;
  onQuickAdd: () => void;
  onExpand: () => void;
  onSettings: () => void;
  onCompactPrev: () => void;
  onCompactNext: () => void;
  onCompactToday: () => void;
}

/**
 * CalendarWidget header with title, action buttons,
 * view selector, and date navigation.
 */
export const CalendarWidgetHeader = memo(function CalendarWidgetHeader({
  isAuthenticated,
  isSyncing,
  compactView,
  compactDateLabel,
  onCompactViewChange,
  onSync,
  onQuickAdd,
  onExpand,
  onSettings,
  onCompactPrev,
  onCompactNext,
  onCompactToday,
}: CalendarWidgetHeaderProps) {
  return (
    <div className="flex-shrink-0 mb-3 space-y-1.5">
      {/* Row 1: Title + Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-neon-primary flex-shrink-0" />
          <h3 className="text-heading text-sm whitespace-nowrap">Calendar</h3>
        </div>

        {/* Actions - always visible */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isAuthenticated && (
            <>
              <SyncStatus compact />
              <Button
                variant="ghost"
                size="icon"
                onClick={onSync}
                disabled={isSyncing}
                className="h-7 w-7"
                title="Sync calendar"
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    isSyncing && 'animate-spin'
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onQuickAdd}
                className="h-7 w-7"
                title="Add event"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onExpand}
                className="h-7 w-7"
                title="Expand calendar"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            className="h-7 w-7"
            title="Calendar settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Row 2: View Selector + Date Navigation */}
      {isAuthenticated && (
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={compactView}
              onChange={(e) => onCompactViewChange(e.target.value as CompactView)}
              className={cn(
                'appearance-none bg-transparent',
                'text-xs text-text-muted',
                'pr-4 cursor-pointer',
                'hover:text-text-secondary transition-colors',
                'focus:outline-none'
              )}
            >
              {COMPACT_VIEWS.map((view: { id: CompactView; label: string }) => (
                <option key={view.id} value={view.id}>
                  {view.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted pointer-events-none" />
          </div>

          {(compactView === 'upcoming' || compactView === 'today') && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={onCompactPrev}
                className="h-6 w-6"
                title="Previous day"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <button
                onClick={onCompactToday}
                className="text-[10px] text-text-muted hover:text-text-secondary transition-colors px-1 min-w-[52px] text-center"
                title="Go to today"
              >
                {compactDateLabel}
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCompactNext}
                className="h-6 w-6"
                title="Next day"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CalendarWidgetHeader.displayName = 'CalendarWidgetHeader';

export default CalendarWidgetHeader;

'use client';

import { memo, useMemo } from 'react';
import { RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/lib/stores/calendar';
import type { SyncStatusProps } from '../types';

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * SyncStatus - Shows last sync time and sync button
 *
 * Displays sync state with manual refresh option.
 * Can be used standalone (reads from store) or with explicit props.
 */
export const SyncStatus = memo(function SyncStatus({
  lastSyncAt: propLastSyncAt,
  isSyncing: propIsSyncing,
  onSync: propOnSync,
  error: propError,
  compact = false,
}: SyncStatusProps) {
  // Get values from store as fallback
  const store = useCalendarStore();

  const lastSyncAt = propLastSyncAt ?? store.lastSyncAt;
  const isSyncing = propIsSyncing ?? store.isSyncing;
  const error = propError ?? store.error;

  const relativeTime = useMemo(() => {
    if (!lastSyncAt) return null;
    return formatRelativeTime(lastSyncAt);
  }, [lastSyncAt]);

  // Compact mode - just show an icon indicator
  if (compact) {
    return (
      <div className="flex items-center" title={lastSyncAt ? `Synced ${relativeTime}` : 'Not synced'}>
        {isSyncing ? (
          <RefreshCw className="h-3 w-3 text-neon-primary animate-spin" />
        ) : error ? (
          <AlertCircle className="h-3 w-3 text-error" />
        ) : lastSyncAt ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <Clock className="h-3 w-3 text-text-muted" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      {/* Status Text */}
      <div className="flex items-center gap-2">
        {isSyncing ? (
          <>
            <RefreshCw className="h-3 w-3 text-neon-primary animate-spin" />
            <span className="text-xs text-text-muted">Syncing...</span>
          </>
        ) : error ? (
          <>
            <AlertCircle className="h-3 w-3 text-error" />
            <span className="text-xs text-error">Sync failed</span>
          </>
        ) : lastSyncAt ? (
          <>
            <Check className="h-3 w-3 text-success" />
            <span className="text-xs text-text-muted">
              Synced {relativeTime}
            </span>
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 text-text-muted" />
            <span className="text-xs text-text-muted">Not synced</span>
          </>
        )}
      </div>

      {/* Sync Button */}
      {propOnSync && (
        <Button
          variant="ghost"
          size="sm"
          onClick={propOnSync}
          disabled={isSyncing}
          className="h-7 px-2"
        >
          <RefreshCw
            className={cn(
              'h-3 w-3',
              isSyncing && 'animate-spin'
            )}
          />
          <span className="ml-1 text-xs">Sync</span>
        </Button>
      )}
    </div>
  );
});

SyncStatus.displayName = 'SyncStatus';

export default SyncStatus;

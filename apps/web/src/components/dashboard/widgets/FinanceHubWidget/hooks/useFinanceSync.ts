'use client';

import { useEffect, useCallback, useState } from 'react';
import { useFinanceHubStore } from '@/lib/stores/financehub';
import { useSession } from '@/components/auth/SessionManager';
import type { SyncStatus, AccountSyncState } from '../shared/SyncProgressDrawer';
import { useFinanceHub } from './useFinanceHub';

/**
 * useFinanceSync - Manages finance sync state, auto-sync scheduling, and sync progress tracking.
 */
export function useFinanceSync() {
  const {
    accounts,
    error,
    setError,
    setSyncing,
  } = useFinanceHubStore();

  const { syncAccounts, cleanupAndRefresh } = useFinanceHub();

  const { user } = useSession();
  const userId = user?.id;

  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncProgressStatus, setSyncProgressStatus] = useState<SyncStatus>('idle');
  const [accountSyncStates, setAccountSyncStates] = useState<Map<string, AccountSyncState>>(new Map());

  // Fetch finance data on mount - cleanup duplicates and fetch fresh data
  useEffect(() => {
    if (userId) {
      cleanupAndRefresh(userId);
    }
  }, [userId, cleanupAndRefresh]);

  // Handle sync - use fullSync=true to bypass throttling for manual refresh
  const handleSync = useCallback(async () => {
    if (!userId) return;

    // Show progress drawer and reset states
    setShowSyncProgress(true);
    setSyncProgressStatus('syncing');
    setAccountSyncStates(new Map());
    setSyncing(true);

    // Mark all linked accounts as syncing
    const linkedAccounts = accounts.filter((a) => !a.isManual);
    const initialStates = new Map<string, AccountSyncState>();
    linkedAccounts.forEach((account) => {
      initialStates.set(account.id, {
        accountId: account.id,
        status: 'syncing',
        startedAt: new Date(),
      });
    });
    setAccountSyncStates(initialStates);

    try {
      await syncAccounts(userId, true);

      // Mark all accounts as success
      const successStates = new Map<string, AccountSyncState>();
      linkedAccounts.forEach((account) => {
        successStates.set(account.id, {
          accountId: account.id,
          status: 'success',
          completedAt: new Date(),
        });
      });
      setAccountSyncStates(successStates);
      setSyncProgressStatus('success');
      setError(null);
      setLastSyncTime(new Date());

      // Auto-close progress drawer after 3 seconds on success
      setTimeout(() => {
        setShowSyncProgress(false);
        setSyncProgressStatus('idle');
      }, 3000);
    } catch (_err) {
      setSyncProgressStatus('error');
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [userId, accounts, syncAccounts, setSyncing, setError]);

  // Auto-sync twice daily at 6 AM and 6 PM
  useEffect(() => {
    const checkScheduledSync = () => {
      const now = new Date();
      const hour = now.getHours();

      // Sync at 6 AM or 6 PM (with 5 minute window)
      if ((hour === 6 || hour === 18) && now.getMinutes() < 5) {
        if (!lastSyncTime || now.getTime() - lastSyncTime.getTime() > 60 * 60 * 1000) {
          handleSync();
        }
      }
    };

    // Check every minute for scheduled sync
    const intervalId = setInterval(checkScheduledSync, 60 * 1000);

    // Initial check
    checkScheduledSync();

    return () => clearInterval(intervalId);
  }, [handleSync, lastSyncTime]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, setError]);

  return {
    userId,
    handleSync,
    // Sync progress drawer state
    showSyncProgress,
    setShowSyncProgress,
    syncProgressStatus,
    setSyncProgressStatus,
    accountSyncStates,
    lastSyncTime,
  };
}

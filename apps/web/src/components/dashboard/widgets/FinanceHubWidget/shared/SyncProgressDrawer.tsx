'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  Building2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFinanceAccounts } from '@/lib/stores/financehub';
import type { FinanceAccount } from '@/types/finance';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface AccountSyncState {
  accountId: string;
  status: SyncStatus;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface SyncProgressDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  accountStates: Map<string, AccountSyncState>;
  onRetryAccount?: (accountId: string) => void;
  onRetryAll?: () => void;
  lastSyncTime?: Date | null;
}

/**
 * SyncProgressDrawer Component
 *
 * Shows detailed sync progress with account-by-account status.
 * Appears as a slide-up drawer from the bottom of the widget.
 */
export function SyncProgressDrawer({
  isOpen,
  onClose,
  syncStatus,
  accountStates,
  onRetryAccount,
  onRetryAll,
  lastSyncTime,
}: SyncProgressDrawerProps) {
  const accounts = useFinanceAccounts();
  const [isExpanded, setIsExpanded] = useState(false);

  // Group accounts by institution
  const accountsByInstitution = accounts.reduce(
    (acc, account) => {
      const institution = account.institutionName || 'Manual Accounts';
      if (!acc[institution]) {
        acc[institution] = [];
      }
      acc[institution].push(account);
      return acc;
    },
    {} as Record<string, FinanceAccount[]>
  );

  // Get sync state for an account
  const getAccountState = useCallback(
    (accountId: string): AccountSyncState => {
      return (
        accountStates.get(accountId) || {
          accountId,
          status: syncStatus === 'idle' ? 'idle' : 'syncing',
        }
      );
    },
    [accountStates, syncStatus]
  );

  // Calculate overall progress
  const totalAccounts = accounts.filter((a) => !a.isManual).length;
  const completedAccounts = Array.from(accountStates.values()).filter(
    (s) => s.status === 'success' || s.status === 'error'
  ).length;
  const errorAccounts = Array.from(accountStates.values()).filter(
    (s) => s.status === 'error'
  ).length;
  const progressPercent =
    totalAccounts > 0 ? (completedAccounts / totalAccounts) * 100 : 0;

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Get status icon
  const getStatusIcon = (status: SyncStatus) => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-text-muted" />;
    }
  };

  // Get overall status message
  const getStatusMessage = () => {
    switch (syncStatus) {
      case 'syncing':
        return `Syncing ${completedAccounts} of ${totalAccounts} accounts...`;
      case 'success':
        if (errorAccounts > 0) {
          return `Sync complete with ${errorAccounts} error${errorAccounts > 1 ? 's' : ''}`;
        }
        return 'All accounts synced successfully';
      case 'error':
        return 'Sync failed';
      default:
        return lastSyncTime
          ? `Last synced ${formatTime(lastSyncTime)}`
          : 'Ready to sync';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
      >
        <div className="bg-surface-3/95 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              {getStatusIcon(syncStatus)}
              <div>
                <h3 className="text-sm font-medium text-white">
                  {syncStatus === 'syncing' ? 'Syncing Accounts' : 'Sync Status'}
                </h3>
                <p className="text-xs text-text-muted">{getStatusMessage()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Expand/Collapse button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {syncStatus === 'syncing' && (
            <div className="px-4 py-2 border-b border-border-subtle">
              <div className="h-1.5 bg-border-subtle rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-neon-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Expanded account list */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="max-h-64 overflow-y-auto"
              >
                <div className="p-4 space-y-4">
                  {Object.entries(accountsByInstitution).map(
                    ([institution, institutionAccounts]) => {
                      // Skip manual accounts in sync view
                      const linkedAccounts = institutionAccounts.filter(
                        (a) => !a.isManual
                      );
                      if (linkedAccounts.length === 0) return null;

                      return (
                        <div key={institution} className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Building2 className="h-3 w-3" />
                            <span>{institution}</span>
                          </div>

                          {linkedAccounts.map((account) => {
                            const state = getAccountState(account.id);
                            return (
                              <div
                                key={account.id}
                                className="flex items-center justify-between pl-5 py-1"
                              >
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(state.status)}
                                  <span className="text-sm text-white">
                                    {account.name}
                                  </span>
                                </div>

                                {state.status === 'error' && onRetryAccount && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => onRetryAccount(account.id)}
                                  >
                                    Retry
                                  </Button>
                                )}

                                {state.message && (
                                  <span className="text-xs text-red-400 truncate max-w-[150px]">
                                    {state.message}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  )}
                </div>

                {/* Footer with retry all button */}
                {errorAccounts > 0 && syncStatus !== 'syncing' && onRetryAll && (
                  <div className="px-4 py-3 border-t border-border-subtle">
                    <Button
                      variant="glass"
                      size="sm"
                      className="w-full"
                      onClick={onRetryAll}
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Retry Failed Accounts ({errorAccounts})
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

SyncProgressDrawer.displayName = 'SyncProgressDrawer';

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Wallet,
  DollarSign,
  RefreshCw,
  Clock,
  X,
  Save,
  Banknote,
  Building2,
  AlertCircle,
  Link2Off,
  Link2,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useFinanceHubStore,
  usePrivacyMode,
  useDailyBudget,
  useFinanceAccounts,
} from '@/lib/stores/financehub';
import { formatCurrency } from '@/types/finance';
import type { FinanceAccount } from '@/types/finance';

interface FinanceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSyncAll?: () => Promise<void>;
  onSyncAccount?: (accountId: string) => Promise<void>;
  onReconnectAccount?: (accountId: string) => void;
  lastSyncTime?: Date | null;
  isSyncing?: boolean;
}

/**
 * FinanceSettings Component
 *
 * Settings panel for finance widget:
 * - Manual cash balance input (creates/updates a cash account)
 * - Daily spending limit setting
 * - Manual sync trigger
 * - Auto-sync schedule info
 */
export function FinanceSettings({
  isOpen,
  onClose,
  userId,
  onSyncAll,
  onSyncAccount,
  onReconnectAccount,
  lastSyncTime,
  isSyncing = false,
}: FinanceSettingsProps) {
  const accounts = useFinanceAccounts();
  const dailyBudget = useDailyBudget();
  const privacyMode = usePrivacyMode();
  const { setDailyBudget, setAccounts, updateAccount, removeAccount } = useFinanceHubStore();

  // Find existing cash account
  const cashAccount = accounts.find(
    (a) => a.type === 'cash' && a.isManual && a.name === 'Cash on Hand'
  );

  // Local form state
  const [cashBalance, setCashBalance] = useState<string>(
    cashAccount?.balanceCurrent?.toString() || '0'
  );
  const [newDailyBudget, setNewDailyBudget] = useState<string>(
    dailyBudget.toString()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  // Group accounts by institution
  const linkedAccounts = accounts.filter((a) => !a.isManual && a.plaidItemId);
  const accountsByInstitution = linkedAccounts.reduce(
    (acc, account) => {
      const institution = account.institutionName || 'Unknown';
      if (!acc[institution]) {
        acc[institution] = [];
      }
      acc[institution].push(account);
      return acc;
    },
    {} as Record<string, FinanceAccount[]>
  );

  // Handle per-account sync
  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!onSyncAccount) return;
    setSyncingAccountId(accountId);
    try {
      await onSyncAccount(accountId);
    } finally {
      setSyncingAccountId(null);
    }
  }, [onSyncAccount]);

  // Handle disconnect account
  const handleDisconnectAccount = useCallback(async (accountId: string) => {
    try {
      const response = await fetch(`/api/finance/accounts/${accountId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Update local state to reflect disconnected account
        // Note: plaidAccessToken is not stored on client, only server-side
        updateAccount(accountId, {
          plaidItemId: undefined,
          syncError: 'Disconnected',
        });
        setConfirmDisconnect(null);
        setSaveMessage('Account disconnected');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      logger.error('Failed to disconnect account', { error, accountId });
      setSaveMessage('Failed to disconnect account');
    }
  }, [updateAccount]);

  // Update local state when account changes
  useEffect(() => {
    if (cashAccount) {
      setCashBalance(cashAccount.balanceCurrent.toString());
    }
  }, [cashAccount]);

  useEffect(() => {
    setNewDailyBudget(dailyBudget.toString());
  }, [dailyBudget]);

  // Save cash balance
  const handleSaveCashBalance = useCallback(async () => {
    const amount = parseFloat(cashBalance) || 0;

    if (cashAccount) {
      // Update existing cash account
      try {
        const response = await fetch(`/api/finance/accounts/${cashAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balanceCurrent: amount }),
        });

        if (response.ok) {
          updateAccount(cashAccount.id, { balanceCurrent: amount });
          return true;
        }
      } catch (error) {
        logger.error('Failed to update cash balance', { error, accountId: cashAccount.id });
      }
    } else {
      // Create new cash account
      try {
        const response = await fetch('/api/finance/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            name: 'Cash on Hand',
            type: 'cash',
            balanceCurrent: amount,
            currency: 'USD',
          }),
        });

        if (response.ok) {
          const newAccount = await response.json();
          setAccounts([...accounts, newAccount]);
          return true;
        }
      } catch (error) {
        logger.error('Failed to create cash account', { error, userId });
      }
    }
    return false;
  }, [cashBalance, cashAccount, userId, accounts, setAccounts, updateAccount]);

  // Save daily budget
  const handleSaveDailyBudget = useCallback(() => {
    const amount = parseFloat(newDailyBudget) || 0;
    setDailyBudget(Math.max(0, amount));
    return true;
  }, [newDailyBudget, setDailyBudget]);

  // Save all settings
  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const [cashSaved, budgetSaved] = await Promise.all([
        handleSaveCashBalance(),
        Promise.resolve(handleSaveDailyBudget()),
      ]);

      if (cashSaved && budgetSaved) {
        setSaveMessage('Settings saved successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Some settings failed to save');
      }
    } catch (error) {
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [handleSaveCashBalance, handleSaveDailyBudget]);

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      return lastSyncTime.toLocaleDateString();
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md bg-surface-3/95 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-neon-primary" />
              <h2 className="text-lg font-semibold text-white">Finance Settings</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-6 space-y-6">
            {/* Cash Balance Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-white">Cash Balance</h3>
              </div>
              <p className="text-xs text-white/60">
                Enter your physical cash not tracked in bank accounts. This will be added to your net worth calculation.
              </p>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashBalance}
                  onChange={(e) => setCashBalance(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white"
                  placeholder="0.00"
                />
              </div>
              {cashAccount && (
                <p className="text-xs text-white/40">
                  Current: {privacyMode ? '••••••' : formatCurrency(cashAccount.balanceCurrent)}
                </p>
              )}
            </div>

            {/* Daily Spending Limit Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-yellow-400" />
                <h3 className="text-sm font-medium text-white">Daily Spending Limit</h3>
              </div>
              <p className="text-xs text-white/60">
                Set your daily spending budget. You&apos;ll see a burn meter showing your progress.
              </p>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={newDailyBudget}
                  onChange={(e) => setNewDailyBudget(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white"
                  placeholder="100"
                />
              </div>
              <p className="text-xs text-white/40">
                Current: {privacyMode ? '••••' : formatCurrency(dailyBudget)}/day
              </p>
            </div>

            {/* Sync Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-medium text-white">Data Sync</h3>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Clock className="h-4 w-4" />
                  <span>Last sync: {formatLastSync()}</span>
                </div>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={onSyncAll}
                  disabled={isSyncing}
                >
                  <RefreshCw className={cn('h-3 w-3 mr-1', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
              <p className="text-xs text-white/40">
                Accounts auto-sync twice daily at 6 AM and 6 PM local time.
              </p>
            </div>

            {/* Account Management Section */}
            {linkedAccounts.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowAccountManagement(!showAccountManagement)}
                  className="flex items-center gap-2 w-full"
                >
                  {showAccountManagement ? (
                    <ChevronDown className="h-4 w-4 text-purple-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-purple-400" />
                  )}
                  <Building2 className="h-4 w-4 text-purple-400" />
                  <h3 className="text-sm font-medium text-white">Linked Accounts</h3>
                  <span className="text-xs text-white/40 ml-auto">
                    {linkedAccounts.length} account{linkedAccounts.length !== 1 ? 's' : ''}
                  </span>
                </button>

                <AnimatePresence>
                  {showAccountManagement && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      {Object.entries(accountsByInstitution).map(([institution, institutionAccounts]) => (
                        <div key={institution} className="space-y-2">
                          <div className="text-xs text-white/60 font-medium">
                            {institution}
                          </div>

                          {institutionAccounts.map((account) => {
                            const hasError = account.syncError && account.syncError !== 'Disconnected';
                            const isDisconnected = account.syncError === 'Disconnected';
                            const isSyncingThis = syncingAccountId === account.id;

                            return (
                              <div
                                key={account.id}
                                className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {hasError ? (
                                    <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                  ) : isDisconnected ? (
                                    <Link2Off className="h-4 w-4 text-text-muted flex-shrink-0" />
                                  ) : (
                                    <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm text-white truncate">
                                      {account.name}
                                    </div>
                                    {hasError && (
                                      <div className="text-xs text-red-400 truncate">
                                        {account.syncError}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {/* Reconnect button for errored accounts */}
                                  {hasError && onReconnectAccount && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-blue-400 hover:text-blue-300"
                                      onClick={() => onReconnectAccount(account.id)}
                                    >
                                      <Link2 className="h-3 w-3 mr-1" />
                                      Reconnect
                                    </Button>
                                  )}

                                  {/* Sync button for connected accounts */}
                                  {!isDisconnected && !hasError && onSyncAccount && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleSyncAccount(account.id)}
                                      disabled={isSyncingThis || isSyncing}
                                    >
                                      <RefreshCw
                                        className={cn(
                                          'h-3 w-3',
                                          isSyncingThis && 'animate-spin'
                                        )}
                                      />
                                    </Button>
                                  )}

                                  {/* Disconnect button */}
                                  {confirmDisconnect === account.id ? (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-red-400"
                                        onClick={() => handleDisconnectAccount(account.id)}
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setConfirmDisconnect(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-text-muted hover:text-red-400"
                                      onClick={() => setConfirmDisconnect(account.id)}
                                      title="Disconnect account"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      <p className="text-xs text-white/40">
                        Disconnecting an account removes the connection but preserves transaction history.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Save Message */}
            {saveMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-3 rounded-lg text-sm text-center',
                  saveMessage.includes('success')
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                )}
              >
                {saveMessage}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-neon-primary hover:bg-neon-primary/90"
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

FinanceSettings.displayName = 'FinanceSettings';

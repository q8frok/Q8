'use client';

import { useCallback, useState } from 'react';
import { useFinanceHubStore } from '@/lib/stores/financehub';
import { useFinanceSync } from './hooks/useFinanceSync';
import { FinanceCompactView } from './compact/FinanceCompactView';
import { FinanceModals } from './shared/FinanceModals';

interface FinanceHubWidgetProps {
  className?: string;
}

/**
 * FinanceHubWidget - Unified Finance Dashboard
 *
 * "Your money, unified. Your future, simulated."
 *
 * Aggregates financial data from multiple sources:
 * - Plaid (Banking, Credit Cards, Loans)
 * - SnapTrade (Investments, Brokerages)
 * - Manual entries (Cash, Private loans)
 *
 * Features:
 * - Net Worth tracking with history
 * - Daily spending meter
 * - Upcoming bills alerts
 * - Privacy mode (blur sensitive data)
 * - Expandable Command Center
 */
export function FinanceHubWidget({ className }: FinanceHubWidgetProps) {
  const { isSyncing } = useFinanceHubStore();

  const {
    userId,
    handleSync,
    showSyncProgress,
    setShowSyncProgress,
    syncProgressStatus,
    setSyncProgressStatus,
    accountSyncStates,
    lastSyncTime,
  } = useFinanceSync();

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleLinkAccount = useCallback(() => {
    setShowLinkModal(true);
  }, []);

  const handleCloseSyncProgress = useCallback(() => {
    setShowSyncProgress(false);
    setSyncProgressStatus('idle');
  }, [setShowSyncProgress, setSyncProgressStatus]);

  return (
    <>
      {/* Compact Widget View */}
      <FinanceCompactView
        className={className}
        onSync={handleSync}
        onLinkAccount={handleLinkAccount}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Modals & Portals */}
      <FinanceModals
        userId={userId}
        handleSync={handleSync}
        showLinkModal={showLinkModal}
        onCloseLinkModal={() => setShowLinkModal(false)}
        showSettings={showSettings}
        onCloseSettings={() => setShowSettings(false)}
        showSyncProgress={showSyncProgress}
        onCloseSyncProgress={handleCloseSyncProgress}
        syncProgressStatus={syncProgressStatus}
        accountSyncStates={accountSyncStates}
        lastSyncTime={lastSyncTime}
        isSyncing={isSyncing}
      />
    </>
  );
}

FinanceHubWidget.displayName = 'FinanceHubWidget';
export default FinanceHubWidget;

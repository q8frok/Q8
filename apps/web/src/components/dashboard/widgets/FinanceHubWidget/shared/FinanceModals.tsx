'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useFinanceHubStore } from '@/lib/stores/financehub';
import { LinkAccountModal } from './LinkAccountModal';
import { FinanceSettings } from './FinanceSettings';
import { SyncProgressDrawer, type SyncStatus, type AccountSyncState } from './SyncProgressDrawer';
import { FinanceCommandCenter } from '../expanded/FinanceCommandCenter';

interface FinanceModalsProps {
  userId: string | undefined;
  handleSync: () => Promise<void>;
  // Link modal
  showLinkModal: boolean;
  onCloseLinkModal: () => void;
  // Settings modal
  showSettings: boolean;
  onCloseSettings: () => void;
  // Sync progress drawer
  showSyncProgress: boolean;
  onCloseSyncProgress: () => void;
  syncProgressStatus: SyncStatus;
  accountSyncStates: Map<string, AccountSyncState>;
  lastSyncTime: Date | null;
  isSyncing: boolean;
}

/**
 * FinanceModals - Renders all modal/portal overlays for the FinanceHub widget.
 *
 * Includes: Expanded Command Center, Link Account Modal,
 * Finance Settings, and Sync Progress Drawer.
 */
export function FinanceModals({
  userId,
  handleSync,
  showLinkModal,
  onCloseLinkModal,
  showSettings,
  onCloseSettings,
  showSyncProgress,
  onCloseSyncProgress,
  syncProgressStatus,
  accountSyncStates,
  lastSyncTime,
  isSyncing,
}: FinanceModalsProps) {
  const { isExpanded, toggleExpanded } = useFinanceHubStore();

  return (
    <>
      {/* Expanded FinanceCommandCenter - Portal to body */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isExpanded && (
              <FinanceCommandCenter onClose={toggleExpanded} />
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Link Account Modal */}
      <LinkAccountModal
        isOpen={showLinkModal}
        onClose={onCloseLinkModal}
        userId={userId}
        onSuccess={() => {
          onCloseLinkModal();
          handleSync();
        }}
      />

      {/* Finance Settings Modal */}
      <FinanceSettings
        isOpen={showSettings}
        onClose={onCloseSettings}
        userId={userId}
        onSyncAll={handleSync}
        lastSyncTime={lastSyncTime}
        isSyncing={isSyncing}
      />

      {/* Sync Progress Drawer */}
      <SyncProgressDrawer
        isOpen={showSyncProgress}
        onClose={onCloseSyncProgress}
        syncStatus={syncProgressStatus}
        accountStates={accountSyncStates}
        lastSyncTime={lastSyncTime}
        onRetryAll={handleSync}
      />
    </>
  );
}

FinanceModals.displayName = 'FinanceModals';

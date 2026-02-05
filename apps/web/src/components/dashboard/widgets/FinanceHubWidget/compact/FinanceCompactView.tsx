'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  RefreshCw,
  Wallet,
  X,
  Link,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFinanceHubStore } from '@/lib/stores/financehub';
import { PrivacyToggle } from '../shared/PrivacyToggle';
import { NetWorthCard } from './NetWorthCard';
import { DailyBurnMeter } from './DailyBurnMeter';
import { AlertCarousel } from './AlertCarousel';

interface FinanceCompactViewProps {
  className?: string;
  onSync: () => void;
  onLinkAccount: () => void;
  onOpenSettings: () => void;
}

/**
 * FinanceCompactView - Compact widget view for the FinanceHub
 *
 * Renders the header bar, error/loading overlays, and the three
 * compact cards: NetWorth, DailyBurn, and AlertCarousel.
 */
export function FinanceCompactView({
  className,
  onSync,
  onLinkAccount,
  onOpenSettings,
}: FinanceCompactViewProps) {
  const {
    isLoading,
    isSyncing,
    error,
    accounts,
    toggleExpanded,
    setError,
  } = useFinanceHubStore();

  return (
    <motion.div
      layout
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-surface-3 backdrop-blur-glass border border-border-subtle',
        'shadow-glass transition-all duration-300',
        className
      )}
    >
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-xs px-3 py-1.5 flex items-center justify-between"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center"
          >
            <div className="h-8 w-8 border-2 border-neon-primary border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-neon-primary" />
          <span className="text-sm font-medium">FinanceHub</span>
          {accounts.length > 0 && (
            <span className="text-xs text-text-muted">
              ({accounts.length} accounts)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Privacy toggle */}
          <PrivacyToggle size="sm" />

          {/* Sync button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onSync}
            disabled={isSyncing}
            title="Sync accounts"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
          </Button>

          {/* Link account button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onLinkAccount}
            title="Link account"
          >
            <Link className="h-3.5 w-3.5" />
          </Button>

          {/* Settings button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenSettings}
            title="Finance settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleExpanded}
            title="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Net Worth Card */}
      <NetWorthCard />

      {/* Divider */}
      <div className="border-t border-border-subtle" />

      {/* Daily Burn Meter */}
      <DailyBurnMeter />

      {/* Divider */}
      <div className="border-t border-border-subtle" />

      {/* Alert Carousel */}
      <AlertCarousel />
    </motion.div>
  );
}

FinanceCompactView.displayName = 'FinanceCompactView';

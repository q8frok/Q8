'use client';

import { memo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { CalendarSelector } from './CalendarSelector';
import { SyncStatus } from './SyncStatus';
import { GoogleAccountsManager } from '@/components/shared/GoogleAccountsManager';
import type { CalendarSettingsProps } from '../types';

/**
 * CalendarSettings - Settings drawer for calendar widget
 *
 * Allows managing Google accounts and selecting visible calendars.
 * Supports multiple Google accounts for calendar aggregation.
 */
export const CalendarSettings = memo(function CalendarSettings({
  isOpen,
  onClose,
}: CalendarSettingsProps) {
  const {
    calendars,
    selectedCalendarIds,
    isAuthenticated: _isAuthenticated,
    isSyncing,
    lastSyncAt,
    error,
    fetchCalendars,
    syncEvents,
    toggleCalendar,
  } = useCalendarSync();

  // Fetch calendars when settings opens
  useEffect(() => {
    if (isOpen && calendars.length === 0) {
      fetchCalendars();
    }
  }, [isOpen, calendars.length, fetchCalendars]);

  // Refresh calendars when accounts change
  const handleAccountsChange = useCallback(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  const handleSelectAll = () => {
    calendars.forEach((cal) => {
      if (!selectedCalendarIds.includes(cal.id)) {
        toggleCalendar(cal.id);
      }
    });
  };

  const handleDeselectAll = () => {
    selectedCalendarIds.forEach((id) => {
      toggleCalendar(id);
    });
  };

  // Group calendars by account
  const calendarsByAccount = calendars.reduce(
    (acc, cal) => {
      const accountKey = cal.googleAccountEmail || 'Unknown';
      if (!acc[accountKey]) {
        acc[accountKey] = {
          email: cal.googleAccountEmail || 'Unknown',
          label: cal.googleAccountLabel,
          calendars: [],
        };
      }
      acc[accountKey].calendars.push(cal);
      return acc;
    },
    {} as Record<string, { email: string; label: string | null | undefined; calendars: typeof calendars }>
  );

  const accountGroups = Object.values(calendarsByAccount);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'absolute inset-0 z-10',
            'bg-surface-2/95 backdrop-blur-sm',
            'flex flex-col'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-neon-primary" />
              <h3 className="text-sm font-semibold text-text-primary">
                Calendar Settings
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Sync Status */}
            <SyncStatus
              lastSyncAt={lastSyncAt}
              isSyncing={isSyncing}
              onSync={() => syncEvents({ forceRefresh: true })}
              error={error}
            />

            {/* Google Accounts Manager */}
            <GoogleAccountsManager
              onAccountsChange={handleAccountsChange}
              showScopeIndicators={false}
              allowPrimaryChange={false}
              title="Google Accounts"
              description="Add accounts to sync calendars from multiple sources."
            />

            {/* Calendar Selection - Grouped by Account */}
            {calendars.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Calendars ({calendars.length})
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs h-6 px-2"
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="text-xs h-6 px-2"
                    >
                      None
                    </Button>
                  </div>
                </div>

                {/* Render calendars grouped by account */}
                {accountGroups.length > 1 ? (
                  // Multiple accounts - show grouped
                  <div className="space-y-4">
                    {accountGroups.map((group) => (
                      <div key={group.email} className="space-y-2">
                        <div className="text-xs text-text-muted font-medium">
                          {group.label || group.email}
                        </div>
                        <CalendarSelector
                          calendars={group.calendars}
                          selectedIds={selectedCalendarIds}
                          onToggle={toggleCalendar}
                          onSelectAll={handleSelectAll}
                          onDeselectAll={handleDeselectAll}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Single account - show flat list
                  <CalendarSelector
                    calendars={calendars}
                    selectedIds={selectedCalendarIds}
                    onToggle={toggleCalendar}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                  />
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border-subtle">
            <Button variant="subtle" onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

CalendarSettings.displayName = 'CalendarSettings';

export default CalendarSettings;

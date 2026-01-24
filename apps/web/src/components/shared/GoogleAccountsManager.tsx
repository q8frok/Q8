'use client';

/**
 * GoogleAccountsManager Component
 *
 * Manages linked Google accounts for multi-account support.
 * Used in CalendarSettings and other Google-integrated features.
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Star,
  StarOff,
  Edit2,
  Check,
  X,
  Mail,
  Calendar,
  Youtube,
  HardDrive,
  Loader2,
  AlertCircle,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

export interface LinkedGoogleAccount {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[];
  isPrimary: boolean;
  label: string | null;
  createdAt: string;
}

export interface GoogleAccountsManagerProps {
  className?: string;
  onAccountsChange?: () => void;
  showScopeIndicators?: boolean;
  allowPrimaryChange?: boolean;
  title?: string;
  description?: string;
}

// ============================================================
// Scope Helpers
// ============================================================

function hasScope(scopes: string[], scopeSubstring: string): boolean {
  return scopes.some((s) => s.toLowerCase().includes(scopeSubstring.toLowerCase()));
}

function getScopeIcon(scopes: string[]) {
  const icons: { icon: typeof Calendar; label: string; active: boolean }[] = [
    { icon: Calendar, label: 'Calendar', active: hasScope(scopes, 'calendar') },
    { icon: Youtube, label: 'YouTube', active: hasScope(scopes, 'youtube') },
    { icon: Mail, label: 'Gmail', active: hasScope(scopes, 'gmail') || hasScope(scopes, 'mail') },
    { icon: HardDrive, label: 'Drive', active: hasScope(scopes, 'drive') },
  ];
  return icons;
}

// ============================================================
// Account Card Component
// ============================================================

interface AccountCardProps {
  account: LinkedGoogleAccount;
  isEditing: boolean;
  editLabel: string;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onLabelChange: (label: string) => void;
  onSetPrimary: () => void;
  onRemove: () => void;
  isUpdating: boolean;
  showScopeIndicators: boolean;
  allowPrimaryChange: boolean;
}

const AccountCard = memo(function AccountCard({
  account,
  isEditing,
  editLabel,
  onEditStart,
  onEditCancel,
  onEditSave,
  onLabelChange,
  onSetPrimary,
  onRemove,
  isUpdating,
  showScopeIndicators,
  allowPrimaryChange,
}: AccountCardProps) {
  const scopeIcons = getScopeIcon(account.scopes);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'surface-matte rounded-lg p-4 border border-white/10',
        account.isPrimary && 'border-neon-primary/30 bg-neon-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {account.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt={account.displayName || account.email}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-white/60" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                type="text"
                value={editLabel}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="Add label (e.g., Work, Personal)"
                className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-1 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-neon-primary/50"
                autoFocus
              />
            ) : (
              <>
                <span className="font-medium text-white truncate">
                  {account.label || account.displayName || account.email.split('@')[0]}
                </span>
                {account.isPrimary && (
                  <span className="px-1.5 py-0.5 text-xs bg-neon-primary/20 text-neon-primary rounded">
                    Primary
                  </span>
                )}
              </>
            )}
          </div>

          <p className="text-sm text-white/60 truncate">{account.email}</p>

          {/* Scope indicators */}
          {showScopeIndicators && (
            <div className="flex items-center gap-2 mt-2">
              {scopeIcons.map(({ icon: Icon, label, active }) => (
                <div
                  key={label}
                  title={`${label}: ${active ? 'Enabled' : 'Not enabled'}`}
                  className={cn(
                    'p-1 rounded',
                    active ? 'text-neon-accent bg-neon-accent/10' : 'text-white/30'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditSave}
                disabled={isUpdating}
                className="h-8 w-8 p-0"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-neon-accent" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditCancel}
                disabled={isUpdating}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditStart}
                className="h-8 w-8 p-0"
                title="Edit label"
              >
                <Edit2 className="w-4 h-4" />
              </Button>

              {allowPrimaryChange && !account.isPrimary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSetPrimary}
                  disabled={isUpdating}
                  className="h-8 w-8 p-0"
                  title="Set as primary"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Star className="w-4 h-4" />
                  )}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={isUpdating}
                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                title="Remove account"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================
// Main Component
// ============================================================

export const GoogleAccountsManager = memo(function GoogleAccountsManager({
  className,
  onAccountsChange,
  showScopeIndicators = true,
  allowPrimaryChange = true,
  title = 'Linked Google Accounts',
  description = 'Add multiple Google accounts to sync calendars from different sources.',
}: GoogleAccountsManagerProps) {
  const [accounts, setAccounts] = useState<LinkedGoogleAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/auth/google-accounts');

      if (!response.ok) {
        if (response.status === 401) {
          setAccounts([]);
          return;
        }
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Check for success params on mount (from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_account_added') === 'true') {
      fetchAccounts();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('google_error')) {
      setError(decodeURIComponent(params.get('google_error') || ''));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchAccounts]);

  // Add account
  const handleAddAccount = useCallback(() => {
    setIsAdding(true);
    // Redirect to add account flow with current page as redirect
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/api/auth/add-google-account?scopes=calendar&redirect=${redirect}`;
  }, []);

  // Edit label
  const handleEditStart = useCallback((account: LinkedGoogleAccount) => {
    setEditingId(account.id);
    setEditLabel(account.label || '');
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditLabel('');
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId) return;

    setUpdatingId(editingId);
    try {
      const response = await fetch('/api/auth/google-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, label: editLabel || null }),
      });

      if (!response.ok) {
        throw new Error('Failed to update label');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
      setEditingId(null);
      setEditLabel('');
      onAccountsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdatingId(null);
    }
  }, [editingId, editLabel, onAccountsChange]);

  // Set primary
  const handleSetPrimary = useCallback(
    async (accountId: string) => {
      setUpdatingId(accountId);
      try {
        const response = await fetch('/api/auth/google-accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: accountId, isPrimary: true }),
        });

        if (!response.ok) {
          throw new Error('Failed to set primary');
        }

        const data = await response.json();
        setAccounts(data.accounts || []);
        onAccountsChange?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
      } finally {
        setUpdatingId(null);
      }
    },
    [onAccountsChange]
  );

  // Remove account
  const handleRemove = useCallback(
    async (accountId: string) => {
      if (!confirm('Are you sure you want to remove this Google account?')) {
        return;
      }

      setUpdatingId(accountId);
      try {
        const response = await fetch(`/api/auth/google-accounts?id=${accountId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to remove account');
        }

        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        onAccountsChange?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove');
      } finally {
        setUpdatingId(null);
      }
    },
    [onAccountsChange]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <p className="text-sm text-white/60 mt-1">{description}</p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleAddAccount}
          disabled={isAdding}
          className="flex items-center gap-2"
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add Account
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && accounts.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-white/40" />
          </div>
          <p className="text-white/60 mb-4">No Google accounts linked yet</p>
          <Button
            variant="default"
            onClick={handleAddAccount}
            disabled={isAdding}
            className="flex items-center gap-2 mx-auto"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add Your First Account
          </Button>
        </div>
      )}

      {/* Account list */}
      {!isLoading && accounts.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isEditing={editingId === account.id}
                editLabel={editLabel}
                onEditStart={() => handleEditStart(account)}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
                onLabelChange={setEditLabel}
                onSetPrimary={() => handleSetPrimary(account.id)}
                onRemove={() => handleRemove(account.id)}
                isUpdating={updatingId === account.id}
                showScopeIndicators={showScopeIndicators}
                allowPrimaryChange={allowPrimaryChange}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

export default GoogleAccountsManager;

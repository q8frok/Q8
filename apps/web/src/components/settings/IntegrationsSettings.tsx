'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Check,
  X,
  RefreshCw,
  Loader2,
  Mail,
  CalendarDays,
  HardDrive,
  Music,
  Github,
  Home,
  Trash2,
  Star,
  Activity,
  CreditCard,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// =============================================================================
// Types
// =============================================================================

interface GoogleAccount {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[];
  isPrimary: boolean;
  label: string | null;
  createdAt: string;
}

interface ToolHealthStatus {
  name: string;
  status: 'ok' | 'degraded' | 'error' | 'not_configured';
  message: string;
  latencyMs?: number;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  tools: ToolHealthStatus[];
}

// =============================================================================
// Component
// =============================================================================

interface IntegrationsSettingsProps {
  userId: string;
}

export function IntegrationsSettings({ userId: _userId }: IntegrationsSettingsProps) {
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);
  const [toolHealth, setToolHealth] = useState<ToolHealthStatus[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);

  const fetchGoogleAccounts = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const res = await fetch('/api/auth/google-accounts');
      if (res.ok) {
        const data = await res.json();
        setGoogleAccounts(data.accounts ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingGoogle(false);
    }
  }, []);

  const fetchToolHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health/tools');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setToolHealth(data.tools ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchGoogleAccounts();
    fetchToolHealth();
  }, [fetchGoogleAccounts, fetchToolHealth]);

  // Check for OAuth callback success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_account_added') === 'true') {
      fetchGoogleAccounts();
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('google_account_added');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());
    }
  }, [fetchGoogleAccounts]);

  const handleConnectGoogle = () => {
    // Navigate to the direct Google OAuth flow with full scopes
    const scopes = 'calendar,gmail,drive';
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/add-google-account?scopes=${scopes}&full_access=true&redirect=${redirect}`;
  };

  const handleRemoveGoogleAccount = async (accountId: string) => {
    if (!confirm('Remove this Google account? Calendar, email, and drive tools will no longer have access to it.')) {
      return;
    }
    setRemovingAccountId(accountId);
    try {
      const res = await fetch(`/api/auth/google-accounts?id=${accountId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setGoogleAccounts((prev) => prev.filter((a) => a.id !== accountId));
      }
    } catch {
      // silently fail
    } finally {
      setRemovingAccountId(null);
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      const res = await fetch('/api/auth/google-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accountId, isPrimary: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleAccounts(data.accounts ?? []);
      }
    } catch {
      // silently fail
    }
  };

  const getToolStatus = (name: string): ToolHealthStatus | undefined => {
    return toolHealth.find((t) => t.name === name);
  };

  return (
    <div className="space-y-8">
      {/* Google Workspace */}
      <GoogleSection
        accounts={googleAccounts}
        loading={loadingGoogle}
        onConnect={handleConnectGoogle}
        onRemove={handleRemoveGoogleAccount}
        onSetPrimary={handleSetPrimary}
        removingId={removingAccountId}
      />

      {/* Service Status */}
      <div className="setting-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="setting-section-header mb-0">Service Status</h3>
          <button
            onClick={fetchToolHealth}
            disabled={loadingHealth}
            className="btn-icon"
            title="Refresh status"
          >
            <RefreshCw className={cn('h-4 w-4', loadingHealth && 'animate-spin')} />
          </button>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Server-side integrations configured via environment variables.
        </p>

        {loadingHealth ? (
          <div className="flex items-center gap-2 text-text-muted text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking services...
          </div>
        ) : (
          <div className="space-y-2">
            <ServiceStatusRow
              icon={Music}
              label="Spotify"
              status={getToolStatus('spotify')}
              description="Music playback, search, and queue control"
              actionLabel={
                getToolStatus('spotify')?.status === 'error' ||
                getToolStatus('spotify')?.status === 'not_configured'
                  ? 'Set up'
                  : undefined
              }
              onAction={
                getToolStatus('spotify')?.status === 'error' ||
                getToolStatus('spotify')?.status === 'not_configured'
                  ? () => { window.location.href = '/api/spotify/auth'; }
                  : undefined
              }
            />
            <ServiceStatusRow
              icon={Github}
              label="GitHub"
              status={getToolStatus('github')}
              description="Repository access, issues, PRs, and code search"
            />
            <ServiceStatusRow
              icon={Home}
              label="Home Assistant"
              status={getToolStatus('home_assistant')}
              description="Smart home device control"
            />
            <ServiceStatusRow
              icon={CalendarDays}
              label="Weather"
              status={getToolStatus('weather')}
              description="Current weather and forecasts"
            />
            <ServiceStatusRow
              icon={CreditCard}
              label="Square"
              status={getToolStatus('square')}
              description="Payment processing"
            />
            <ServiceStatusRow
              icon={Activity}
              label="Oura Ring"
              status={getToolStatus('oura_ring')}
              description="Health & sleep tracking"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Google Section
// =============================================================================

interface GoogleSectionProps {
  accounts: GoogleAccount[];
  loading: boolean;
  onConnect: () => void;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
  removingId: string | null;
}

function GoogleSection({ accounts, loading, onConnect, onRemove, onSetPrimary, removingId }: GoogleSectionProps) {
  const hasCalendar = (scopes: string[]) => scopes.some((s) => s.includes('calendar'));
  const hasGmail = (scopes: string[]) => scopes.some((s) => s.includes('gmail') || s.includes('mail'));
  const hasDrive = (scopes: string[]) => scopes.some((s) => s.includes('drive'));

  return (
    <div className="setting-section">
      <h3 className="setting-section-header">Google Workspace</h3>
      <p className="text-sm text-text-muted mb-4">
        Connect your Google account to use Calendar, Gmail, and Drive tools.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted text-sm py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading accounts...
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-border-subtle p-4 text-center">
          <p className="text-sm text-text-muted mb-3">
            No Google account linked. Connect one to enable Calendar, Gmail, and Drive tools.
          </p>
          <Button variant="neon" size="sm" onClick={onConnect}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Google Account
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-lg border border-border-subtle p-3"
            >
              {account.avatarUrl ? (
                <img
                  src={account.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-text-muted" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {account.email}
                  </span>
                  {account.isPrimary && (
                    <span className="text-xs bg-neon-primary/15 text-neon-primary px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {hasCalendar(account.scopes) && (
                    <ScopeBadge icon={CalendarDays} label="Calendar" />
                  )}
                  {hasGmail(account.scopes) && (
                    <ScopeBadge icon={Mail} label="Gmail" />
                  )}
                  {hasDrive(account.scopes) && (
                    <ScopeBadge icon={HardDrive} label="Drive" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!account.isPrimary && (
                  <button
                    onClick={() => onSetPrimary(account.id)}
                    className="btn-icon"
                    title="Set as primary"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onRemove(account.id)}
                  disabled={removingId === account.id}
                  className="btn-icon text-red-400 hover:text-red-300"
                  title="Remove account"
                >
                  {removingId === account.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={onConnect}
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Add another Google account
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Shared components
// =============================================================================

function ScopeBadge({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-text-muted">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

interface ServiceStatusRowProps {
  icon: typeof Music;
  label: string;
  status: ToolHealthStatus | undefined;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function ServiceStatusRow({ icon: Icon, label, status, description, actionLabel, onAction }: ServiceStatusRowProps) {
  const s = status?.status;
  const statusColor =
    s === 'ok'
      ? 'text-emerald-400'
      : s === 'degraded'
        ? 'text-amber-400'
        : s === 'not_configured'
          ? 'text-text-muted'
          : 'text-red-400';

  const statusIcon =
    s === 'ok' ? (
      <Check className={cn('h-4 w-4', statusColor)} />
    ) : s === 'degraded' ? (
      <RefreshCw className={cn('h-4 w-4', statusColor)} />
    ) : s === 'not_configured' ? (
      <Minus className={cn('h-4 w-4', statusColor)} />
    ) : (
      <X className={cn('h-4 w-4', statusColor)} />
    );

  const statusLabel =
    s === 'ok'
      ? 'Connected'
      : s === 'degraded'
        ? 'Degraded'
        : s === 'not_configured'
          ? 'Not Configured'
          : 'Error';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle p-3">
      <Icon className="h-5 w-5 text-text-muted flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-text-muted truncate">{description}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {status ? (
          <>
            {statusIcon}
            <span className={cn('text-xs', statusColor)}>
              {statusLabel}
            </span>
            {actionLabel && onAction && (
              <button
                onClick={onAction}
                className="ml-1 text-xs text-neon-primary hover:underline"
              >
                {actionLabel}
              </button>
            )}
          </>
        ) : (
          <span className="text-xs text-text-muted">Unknown</span>
        )}
      </div>
    </div>
  );
}

IntegrationsSettings.displayName = 'IntegrationsSettings';

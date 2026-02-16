'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  User,
  Palette,
  Volume2,
  Brain,
  Shield,
  Keyboard,
  Eye,
  Sparkles,
  AlertCircle,
  Moon,
  Sun,
  Monitor,
  Check,
  Wrench,
  MessageSquare,
  Quote,
  Route,
  Coffee,
  Zap,
  LayoutGrid,
  Clock,
  CloudSun,
  CheckSquare,
  CalendarDays,
  StickyNote,
  Play,
  Github,
  Home,
  TrendingUp,
  Key,
  Plug,
  Briefcase,
  ShieldCheck,
  Activity,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { MemoriesSettings } from '@/components/settings/MemoriesSettings';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import type { UserPreferences } from '@/lib/memory/types';
import {
  useCurrentMode,
  useVisibleWidgets,
  useDashboardActions,
  ALL_WIDGET_IDS,
  WIDGET_META,
  type DashboardWidgetId,
} from '@/lib/stores/dashboard';

type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'display'
  | 'voice'
  | 'agents'
  | 'memories'
  | 'api-keys'
  | 'integrations'
  | 'privacy'
  | 'shortcuts';

const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'display', label: 'Display', icon: Eye },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'agents', label: 'Agents', icon: Brain },
  { id: 'memories', label: 'Memories', icon: Sparkles },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

const defaultPreferences: Partial<UserPreferences> = {
  communicationStyle: 'concise',
  responseLength: 'medium',
  preferredVoice: 'nova',
  speechSpeed: 1.0,
  theme: 'dark',
  showToolExecutions: true,
  showAgentMarkers: true,
  showCitations: true,
  showRoutingDecisions: false,
  defaultAgent: 'personality',
  agentPersonality: 'friendly',
  memoryRetention: 'month',
  shareAnalytics: false,
};

export default function SettingsPage() {
  const { userId, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>(defaultPreferences);
  const [savedPreferences, setSavedPreferences] = useState<Partial<UserPreferences>>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(savedPreferences),
    [preferences, savedPreferences]
  );

  useEffect(() => {
    if (!userId) return;
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getPreferences', userId }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setPreferences(data.preferences);
            setSavedPreferences(data.preferences);
          }
        }
      } catch (error) {
        logger.error('Failed to load preferences', { error, userId });
      }
    };
    fetchPreferences();
  }, [userId]);

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updatePreferences', userId, preferences }),
      });
      setSavedPreferences(preferences);
    } catch (error) {
      logger.error('Failed to save preferences', { error, userId });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  if (isLoading || !userId) return null;

  return (
    <main className="min-h-screen relative">
      <div className="container mx-auto py-4 md:py-6 px-3 md:px-4 safe-area-container max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-surface-3 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Settings className="h-5 w-5 text-neon-primary" />
            <h1 className="text-xl font-semibold">Settings</h1>
            {isDirty && (
              <span className="flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
                <AlertCircle className="h-3 w-3" />
                Unsaved
              </span>
            )}
          </div>
          <Button
            variant="neon"
            onClick={savePreferences}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </header>

        <div className="flex gap-6">
          {/* Sidebar Nav */}
          <nav className="w-52 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors focus-ring',
                  activeTab === tab.id
                    ? 'bg-neon-primary/15 text-neon-primary font-medium'
                    : 'hover:bg-surface-4 text-text-muted'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content Area */}
          <div className="flex-1 surface-matte rounded-2xl p-6 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {activeTab === 'profile' && (
              <ProfileSettings preferences={preferences} updatePreference={updatePreference} />
            )}
            {activeTab === 'appearance' && (
              <AppearanceSettings preferences={preferences} updatePreference={updatePreference} />
            )}
            {activeTab === 'display' && (
              <DisplaySettings preferences={preferences} updatePreference={updatePreference} />
            )}
            {activeTab === 'voice' && (
              <VoiceSettings preferences={preferences} updatePreference={updatePreference} />
            )}
            {activeTab === 'agents' && (
              <AgentSettings preferences={preferences} updatePreference={updatePreference} />
            )}
            {activeTab === 'memories' && <MemoriesSettings userId={userId} />}
            {activeTab === 'api-keys' && <ApiKeysSettings />}
            {activeTab === 'integrations' && <IntegrationsSettings userId={userId} />}
            {activeTab === 'privacy' && (
              <PrivacySettings preferences={preferences} updatePreference={updatePreference} />
            )}
            {activeTab === 'shortcuts' && <ShortcutsSettings />}
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Shared Components
// ============================================================

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-content">
        <div className="setting-row-label">{label}</div>
        {description && <div className="setting-row-description">{description}</div>}
      </div>
      {children}
    </div>
  );
}

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
}

function OptionCard({ selected, onClick, label, description }: OptionCardProps) {
  return (
    <button onClick={onClick} className="option-card" data-selected={selected}>
      {selected ? (
        <Check className="option-card-icon" style={{ opacity: 1 }} />
      ) : (
        <span className="option-card-icon" />
      )}
      <div className="flex-1">
        <div className="option-card-label">{label}</div>
        {description && <div className="option-card-description">{description}</div>}
      </div>
    </button>
  );
}

// ============================================================
// Settings Sections
// ============================================================

interface SettingsSectionProps {
  preferences: Partial<UserPreferences>;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

function ProfileSettings({ preferences, updatePreference }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Profile & Communication</h2>
      <div className="setting-section">
        <h3 className="setting-section-header">Communication Style</h3>
        <div className="grid grid-cols-2 gap-2">
          {(['concise', 'detailed'] as const).map((style) => (
            <OptionCard
              key={style}
              selected={preferences.communicationStyle === style}
              onClick={() => updatePreference('communicationStyle', style)}
              label={style === 'concise' ? 'Concise' : 'Detailed'}
              description={style === 'concise' ? 'Brief, to-the-point responses' : 'Thorough explanations'}
            />
          ))}
        </div>
      </div>
      <div className="setting-section">
        <h3 className="setting-section-header">Response Length</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['short', 'medium', 'long'] as const).map((length) => (
            <button
              key={length}
              onClick={() => updatePreference('responseLength', length)}
              className={cn(
                'py-2.5 rounded-lg border text-sm capitalize transition-colors',
                preferences.responseLength === length
                  ? 'border-neon-primary bg-neon-primary/10 text-text-primary'
                  : 'border-border-subtle hover:bg-surface-4 text-text-muted'
              )}
            >
              {length}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings({ preferences, updatePreference }: SettingsSectionProps) {
  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ] as const;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Appearance</h2>
      <div className="setting-section">
        <h3 className="setting-section-header">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => updatePreference('theme', theme.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors',
                preferences.theme === theme.id
                  ? 'border-neon-primary bg-neon-primary/10'
                  : 'border-border-subtle hover:bg-surface-4'
              )}
            >
              <theme.icon
                className={cn('h-6 w-6', preferences.theme === theme.id ? 'text-neon-primary' : 'text-text-muted')}
              />
              <span className="text-sm">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceSettings({ preferences, updatePreference }: SettingsSectionProps) {
  const voices = [
    { id: 'nova', label: 'Nova', desc: 'Friendly & upbeat' },
    { id: 'alloy', label: 'Alloy', desc: 'Neutral & balanced' },
    { id: 'echo', label: 'Echo', desc: 'Warm & conversational' },
    { id: 'fable', label: 'Fable', desc: 'Expressive & dynamic' },
    { id: 'onyx', label: 'Onyx', desc: 'Deep & authoritative' },
    { id: 'shimmer', label: 'Shimmer', desc: 'Clear & gentle' },
  ];
  const speedPercentage = (((preferences.speechSpeed || 1) - 0.5) / 1.5) * 100;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Voice Settings</h2>
      <div className="setting-section">
        <h3 className="setting-section-header">Voice Selection</h3>
        <div className="grid grid-cols-2 gap-2">
          {voices.map((voice) => (
            <OptionCard
              key={voice.id}
              selected={preferences.preferredVoice === voice.id}
              onClick={() => updatePreference('preferredVoice', voice.id)}
              label={voice.label}
              description={voice.desc}
            />
          ))}
        </div>
      </div>
      <div className="setting-section">
        <h3 className="setting-section-header">Speech Speed</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Speed</span>
            <span className="font-medium">{preferences.speechSpeed}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={preferences.speechSpeed || 1}
            onChange={(e) => updatePreference('speechSpeed', parseFloat(e.target.value))}
            className="slider-track w-full"
            style={{ '--slider-progress': `${speedPercentage}%` } as React.CSSProperties}
          />
          <div className="flex justify-between text-xs text-text-muted">
            <span>0.5x</span>
            <span>2x</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentSettings({ preferences, updatePreference }: SettingsSectionProps) {
  const personalities = [
    { id: 'professional', label: 'Professional', desc: 'Formal and business-like' },
    { id: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
    { id: 'witty', label: 'Witty', desc: 'Clever and humorous' },
  ] as const;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Agent Configuration</h2>
      <div className="setting-section">
        <h3 className="setting-section-header">Agent Personality</h3>
        <div className="space-y-2">
          {personalities.map((p) => (
            <OptionCard
              key={p.id}
              selected={preferences.agentPersonality === p.id}
              onClick={() => updatePreference('agentPersonality', p.id)}
              label={p.label}
              description={p.desc}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ApiKeysSettings() {
  const providers = [
    { name: 'OpenAI', envVar: 'OPENAI_API_KEY', agent: 'Orchestrator, Home' },
    { name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', agent: 'DevBot (Coder)' },
    { name: 'Perplexity', envVar: 'PERPLEXITY_API_KEY', agent: 'ResearchBot' },
    { name: 'Google AI', envVar: 'GOOGLE_GENERATIVE_AI_KEY', agent: 'Secretary, Finance' },
    { name: 'xAI (Grok)', envVar: 'XAI_API_KEY', agent: 'PersonalityBot' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">API Keys</h2>
      <p className="text-sm text-text-muted mb-4">
        API keys are configured via environment variables in <code className="text-xs bg-surface-3 px-1.5 py-0.5 rounded">.env.local</code>.
        For security, they cannot be viewed or edited from the UI.
      </p>
      <div className="space-y-3">
        {providers.map((provider) => (
          <div key={provider.envVar} className="setting-row">
            <div className="setting-row-content">
              <div className="setting-row-label">{provider.name}</div>
              <div className="setting-row-description">
                {provider.envVar} &middot; {provider.agent}
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-surface-3 text-text-muted">
              Server-side
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// IntegrationsSettings is now imported from @/components/settings/IntegrationsSettings

function PrivacySettings({ preferences, updatePreference }: SettingsSectionProps) {
  const retentionOptions = [
    { id: 'session', label: 'Session only', desc: 'Cleared when you leave' },
    { id: 'week', label: '1 Week', desc: 'Deleted after 7 days' },
    { id: 'month', label: '1 Month', desc: 'Deleted after 30 days' },
    { id: 'forever', label: 'Forever', desc: 'Kept indefinitely' },
  ] as const;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Privacy & Data</h2>
      <div className="setting-section">
        <h3 className="setting-section-header">Memory Retention</h3>
        <div className="space-y-2">
          {retentionOptions.map((option) => (
            <OptionCard
              key={option.id}
              selected={preferences.memoryRetention === option.id}
              onClick={() => updatePreference('memoryRetention', option.id)}
              label={option.label}
              description={option.desc}
            />
          ))}
        </div>
      </div>
      <div className="setting-section">
        <h3 className="setting-section-header">Analytics</h3>
        <SettingRow label="Share anonymous analytics" description="Help improve Q8 by sharing usage data">
          <Toggle
            checked={preferences.shareAnalytics || false}
            onChange={(checked) => updatePreference('shareAnalytics', checked)}
            aria-label="Share anonymous analytics"
          />
        </SettingRow>
      </div>
    </div>
  );
}

function ShortcutsSettings() {
  const shortcuts = [
    { keys: ['Space'], action: 'Push-to-talk (hold)' },
    { keys: ['⌘', 'K'], action: 'Open command palette' },
    { keys: ['⌘', '/'], action: 'Focus chat input' },
    { keys: ['⌘', '.'], action: 'Open settings' },
    { keys: ['Esc'], action: 'Close modal / Cancel' },
    { keys: ['⌘', 'Enter'], action: 'Send message' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
      <div className="space-y-1">
        {shortcuts.map((shortcut, i) => (
          <div key={i} className="setting-row">
            <span className="text-sm text-text-secondary">{shortcut.action}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, j) => (
                <kbd
                  key={j}
                  className="px-2 py-1 text-xs rounded-md bg-surface-3 border border-border-subtle font-mono"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const WIDGET_ICONS: Record<DashboardWidgetId, typeof Clock> = {
  'daily-brief': Sparkles,
  clock: Clock,
  weather: CloudSun,
  tasks: CheckSquare,
  calendar: CalendarDays,
  'quick-notes': StickyNote,
  'content-hub': Play,
  github: Github,
  home: Home,
  finance: TrendingUp,
  'work-ops': Briefcase,
  approvals: ShieldCheck,
  health: Activity,
  knowledge: Brain,
  people: Users,
  growth: TrendingUp,
  alerts: AlertTriangle,
};

function DisplaySettings({ preferences, updatePreference }: SettingsSectionProps) {
  const displayOptions = [
    {
      key: 'showToolExecutions' as const,
      label: 'Tool Executions',
      description: 'Show when Q8 uses tools like search, calendar, or home controls',
      icon: Wrench,
    },
    {
      key: 'showAgentMarkers' as const,
      label: 'Agent Indicators',
      description: 'Show which specialist agent is handling your request',
      icon: MessageSquare,
    },
    {
      key: 'showCitations' as const,
      label: 'Inline Citations',
      description: 'Show source references in research responses',
      icon: Quote,
    },
    {
      key: 'showRoutingDecisions' as const,
      label: 'Routing Details',
      description: 'Show why a specific agent was chosen for your request',
      icon: Route,
    },
  ];

  const currentMode = useCurrentMode();
  const visibleWidgets = useVisibleWidgets();
  const { setMode, toggleWidget, reorderWidgets } = useDashboardActions();

  const modeOptions = [
    { id: 'relax' as const, label: 'Relax', icon: Coffee },
    { id: 'productivity' as const, label: 'Focus', icon: Zap },
    { id: 'all' as const, label: 'All', icon: LayoutGrid },
  ];

  const phase2Order: DashboardWidgetId[] = [
    'daily-brief',
    'work-ops',
    'approvals',
    'alerts',
    'finance',
    'home',
    'health',
    'knowledge',
    'people',
    'growth',
    'calendar',
    'tasks',
    'quick-notes',
    'weather',
    'clock',
    'content-hub',
    'github',
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-4">Display & Dashboard</h2>

      {/* Response Visibility */}
      <div className="setting-section">
        <h3 className="setting-section-header">Response Visibility</h3>
        <div className="space-y-3">
          {displayOptions.map((option) => (
            <SettingRow key={option.key} label={option.label} description={option.description}>
              <div className="flex items-center gap-3">
                <option.icon className="h-4 w-4 text-text-muted" />
                <Toggle
                  checked={preferences[option.key] ?? true}
                  onChange={(checked) => updatePreference(option.key, checked)}
                  aria-label={option.label}
                />
              </div>
            </SettingRow>
          ))}
        </div>
      </div>

      {/* Dashboard Mode */}
      <div className="setting-section">
        <h3 className="setting-section-header">Dashboard Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {modeOptions.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setMode(mode.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border text-sm transition-colors',
                  isActive
                    ? 'border-neon-primary bg-neon-primary/10 text-text-primary'
                    : 'border-border-subtle hover:bg-surface-4 text-text-muted'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-neon-primary')} />
                <span className="font-medium">{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-surface-3/50 px-3 py-2">
          <p className="text-xs text-text-muted">Need the newest panels visible right away?</p>
          <button
            onClick={() => {
              setMode('all');
              reorderWidgets(phase2Order);
            }}
            className="text-xs px-2 py-1 rounded bg-neon-primary/20 text-neon-primary hover:bg-neon-primary/30"
          >
            Reset to Phase 2 Layout
          </button>
        </div>
      </div>

      {/* Widget Visibility */}
      <div className="setting-section">
        <h3 className="setting-section-header">Widget Visibility</h3>
        <div className="space-y-2">
          {ALL_WIDGET_IDS.map((id) => {
            const Icon = WIDGET_ICONS[id];
            const meta = WIDGET_META[id];
            return (
              <SettingRow key={id} label={meta.label}>
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-text-muted" />
                  <Toggle
                    checked={visibleWidgets.includes(id)}
                    onChange={() => toggleWidget(id)}
                    aria-label={`Toggle ${meta.label}`}
                  />
                </div>
              </SettingRow>
            );
          })}
        </div>
      </div>
    </div>
  );
}

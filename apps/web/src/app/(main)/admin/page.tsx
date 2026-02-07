'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Activity, BarChart3, Route, Zap, RefreshCw } from 'lucide-react';
import { AgentMetricsPanel } from '@/components/admin/AgentMetricsPanel';
import { RoutingInsights } from '@/components/admin/RoutingInsights';
import { ToolUsagePanel } from '@/components/admin/ToolUsagePanel';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type AdminTab = 'overview' | 'agents' | 'routing' | 'tools';

const tabs: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'agents', label: 'Agent Metrics', icon: BarChart3 },
  { id: 'routing', label: 'Routing Insights', icon: Route },
  { id: 'tools', label: 'Tool Usage', icon: Zap },
];

export default function AdminPage() {
  const { userId, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger re-fetch of data in child components
    setLastRefreshed(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (isLoading || !userId) {
    return (
      <main className="min-h-screen relative flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative">
      <div className="container mx-auto py-4 md:py-6 px-3 md:px-4 safe-area-container max-w-6xl">
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
            <Activity className="h-5 w-5 text-neon-primary" />
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>
          <Button
            variant="subtle"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
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
            {activeTab === 'overview' && (
              <OverviewPanel lastRefreshed={lastRefreshed} />
            )}
            {activeTab === 'agents' && (
              <AgentMetricsPanel lastRefreshed={lastRefreshed} />
            )}
            {activeTab === 'routing' && (
              <RoutingInsights lastRefreshed={lastRefreshed} />
            )}
            {activeTab === 'tools' && (
              <ToolUsagePanel lastRefreshed={lastRefreshed} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

interface PanelProps {
  lastRefreshed: Date;
}

function OverviewPanel({ lastRefreshed }: PanelProps) {
  const [stats, setStats] = useState({
    totalRequests: 0,
    avgLatency: 0,
    successRate: 0,
    activeAgents: 0,
  });

  useEffect(() => {
    // Fetch overview stats
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/metrics');
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalRequests: data.totalRequests ?? 0,
            avgLatency: data.avgLatency ?? 0,
            successRate: data.successRate ?? 0,
            activeAgents: data.activeAgents ?? 7,
          });
        }
      } catch {
        // Use defaults on error
      }
    };
    fetchStats();
  }, [lastRefreshed]);

  const cards = [
    {
      label: 'Total Requests (24h)',
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
      color: 'text-neon-primary',
    },
    {
      label: 'Avg Latency',
      value: `${stats.avgLatency.toFixed(0)}ms`,
      icon: Zap,
      color: 'text-yellow-500',
    },
    {
      label: 'Success Rate',
      value: `${(stats.successRate * 100).toFixed(1)}%`,
      icon: BarChart3,
      color: 'text-green-500',
    },
    {
      label: 'Active Agents',
      value: stats.activeAgents.toString(),
      icon: Route,
      color: 'text-blue-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">System Overview</h2>
        <p className="text-sm text-text-muted">
          Real-time metrics for the Q8 agent orchestration system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-xl bg-surface-2 border border-border-subtle"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn('h-4 w-4', card.color)} />
              <span className="text-xs text-text-muted">{card.label}</span>
            </div>
            <p className="text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="pt-4 border-t border-border-subtle">
        <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
        <div className="flex gap-3">
          <Link
            href="/settings"
            className="px-4 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-sm transition-colors"
          >
            Agent Settings
          </Link>
          <button
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            className="px-4 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-sm transition-colors"
          >
            Supabase Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

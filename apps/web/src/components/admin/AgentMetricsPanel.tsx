'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Bot, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentMetrics {
  agent: string;
  successRate: number;
  avgLatency: number;
  totalRequests: number;
  recentFailures: number;
}

interface AgentMetricsPanelProps {
  lastRefreshed: Date;
}

const AGENT_COLORS: Record<string, string> = {
  coder: '#8B5CF6', // purple
  researcher: '#3B82F6', // blue
  secretary: '#10B981', // green
  home: '#F59E0B', // amber
  finance: '#EC4899', // pink
  personality: '#06B6D4', // cyan
  orchestrator: '#6366F1', // indigo
};

const AGENT_LABELS: Record<string, string> = {
  coder: 'DevBot',
  researcher: 'ResearchBot',
  secretary: 'SecretaryBot',
  home: 'HomeBot',
  finance: 'FinanceBot',
  personality: 'PersonalityBot',
  orchestrator: 'Orchestrator',
};

export function AgentMetricsPanel({ lastRefreshed }: AgentMetricsPanelProps) {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/routing/feedback');
        if (response.ok) {
          const data = await response.json();
          if (data.agentMetrics) {
            setMetrics(
              Object.entries(data.agentMetrics)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([agent, m]) => ({
                  agent,
                  ...(m as Omit<AgentMetrics, 'agent'>),
                }))
            );
          }
        }
      } catch {
        // Use mock data on error
        setMetrics([
          { agent: 'coder', successRate: 0.95, avgLatency: 2500, totalRequests: 42, recentFailures: 2 },
          { agent: 'researcher', successRate: 0.92, avgLatency: 3200, totalRequests: 38, recentFailures: 3 },
          { agent: 'secretary', successRate: 0.98, avgLatency: 1800, totalRequests: 25, recentFailures: 1 },
          { agent: 'personality', successRate: 0.99, avgLatency: 1200, totalRequests: 156, recentFailures: 2 },
          { agent: 'finance', successRate: 0.94, avgLatency: 2100, totalRequests: 18, recentFailures: 1 },
          { agent: 'home', successRate: 0.97, avgLatency: 800, totalRequests: 12, recentFailures: 0 },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetrics();
  }, [lastRefreshed]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Loading metrics...</div>
      </div>
    );
  }

  const chartData = metrics.map((m) => ({
    name: AGENT_LABELS[m.agent] || m.agent,
    agent: m.agent,
    successRate: m.successRate * 100,
    latency: m.avgLatency,
    requests: m.totalRequests,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Agent Performance</h2>
        <p className="text-sm text-text-muted">
          Success rates and response times for each specialist agent (last 24 hours).
        </p>
      </div>

      {/* Success Rate Chart */}
      <div className="p-4 rounded-xl bg-surface-2 border border-border-subtle">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          Success Rate by Agent
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface-2))',
                  border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Success Rate']}
              />
              <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.agent} fill={AGENT_COLORS[entry.agent] || '#6366F1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div
            key={m.agent}
            className="p-4 rounded-xl bg-surface-2 border border-border-subtle"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: AGENT_COLORS[m.agent] }}
              />
              <span className="font-medium text-sm">{AGENT_LABELS[m.agent] || m.agent}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Success
                </span>
                <span
                  className={cn(
                    'font-medium',
                    m.successRate >= 0.95 ? 'text-green-500' : m.successRate >= 0.9 ? 'text-yellow-500' : 'text-red-500'
                  )}
                >
                  {(m.successRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Latency
                </span>
                <span>{m.avgLatency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  Requests
                </span>
                <span>{m.totalRequests}</span>
              </div>
              {m.recentFailures > 0 && (
                <div className="flex justify-between text-yellow-500">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Failures
                  </span>
                  <span>{m.recentFailures}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

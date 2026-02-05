'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Cpu, GitBranch, Timer } from 'lucide-react';

interface RoutingInsightsProps {
  lastRefreshed: Date;
}

interface RoutingSourceData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface LatencyTrendData {
  hour: string;
  latency: number;
}

const SOURCE_COLORS = {
  heuristic: '#10B981', // green
  llm: '#8B5CF6', // purple
  vector: '#3B82F6', // blue
  fallback: '#F59E0B', // amber
};

export function RoutingInsights({ lastRefreshed }: RoutingInsightsProps) {
  const [routingSources, setRoutingSources] = useState<RoutingSourceData[]>([]);
  const [latencyTrend, setLatencyTrend] = useState<LatencyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/metrics');
        if (response.ok) {
          const data = await response.json();
          if (data.routingSources) {
            setRoutingSources(
              Object.entries(data.routingSources).map(([name, value]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                value: value as number,
                color: SOURCE_COLORS[name as keyof typeof SOURCE_COLORS] || '#6366F1',
              }))
            );
          }
          if (data.latencyTrend) {
            setLatencyTrend(data.latencyTrend);
          }
        }
      } catch {
        // Use mock data on error
        setRoutingSources([
          { name: 'Heuristic', value: 65, color: SOURCE_COLORS.heuristic },
          { name: 'LLM', value: 25, color: SOURCE_COLORS.llm },
          { name: 'Vector', value: 8, color: SOURCE_COLORS.vector },
          { name: 'Fallback', value: 2, color: SOURCE_COLORS.fallback },
        ]);
        setLatencyTrend(
          Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            latency: 1500 + Math.random() * 1000,
          }))
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [lastRefreshed]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Routing Insights</h2>
        <p className="text-sm text-text-muted">
          Analysis of how messages are routed to specialist agents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Routing Source Distribution */}
        <div className="p-4 rounded-xl bg-surface-2 border border-border-subtle">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-neon-primary" />
            Routing Source Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={routingSources}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {routingSources.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface-2))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${value}%`, 'Share']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Trend */}
        <div className="p-4 rounded-xl bg-surface-2 border border-border-subtle">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Timer className="h-4 w-4 text-yellow-500" />
            Latency Trend (24h)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyTrend}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface-2))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${Number(value).toFixed(0)}ms`, 'Latency']}
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Routing Method Explanations */}
      <div className="p-4 rounded-xl bg-surface-2 border border-border-subtle">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-blue-500" />
          Routing Methods
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS.heuristic }} />
              <span className="text-sm font-medium">Heuristic</span>
            </div>
            <p className="text-xs text-text-muted">
              Keyword matching and pattern detection for fast routing.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS.llm }} />
              <span className="text-sm font-medium">LLM</span>
            </div>
            <p className="text-xs text-text-muted">
              AI-based intent classification for complex queries.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS.vector }} />
              <span className="text-sm font-medium">Vector</span>
            </div>
            <p className="text-xs text-text-muted">
              Semantic similarity search using embeddings.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS.fallback }} />
              <span className="text-sm font-medium">Fallback</span>
            </div>
            <p className="text-xs text-text-muted">
              Default to personality agent when uncertain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { PieChartIcon, BarChart3, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFilteredTransactions } from '@/lib/stores/financehub';
import { formatCurrency, formatCompactCurrency, getCategoryIcon } from '@/types/finance';
import { useState } from 'react';

interface SpendingBreakdownProps {
  className?: string;
}

type ChartView = 'pie' | 'bar';
type TimeRange = '7d' | '30d' | '90d' | 'all';

const COLORS = [
  '#00D9FF', // neon primary
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#FFE66D', // yellow
  '#95E1D3', // mint
  '#F38181', // coral
  '#AA96DA', // purple
  '#FCBAD3', // pink
  '#A8D8EA', // light blue
  '#FFB347', // orange
];

/**
 * SpendingBreakdown Component
 *
 * Visualizes spending by category with:
 * - Pie chart and bar chart views
 * - Time range filters
 * - Category drill-down
 */
export function SpendingBreakdown({ className }: SpendingBreakdownProps) {
  const transactions = useFilteredTransactions();
  const [chartView, setChartView] = useState<ChartView>('pie');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Filter transactions by time range and only expenses
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    return transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && tx.amount < 0; // Only expenses
    });
  }, [transactions, timeRange]);

  // Group by category
  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();

    for (const tx of filteredTransactions) {
      const category = tx.category[0] || 'Other';
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + Math.abs(tx.amount));
    }

    // Convert to array and sort by amount
    const data = Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        icon: getCategoryIcon(name),
      }))
      .sort((a, b) => b.value - a.value);

    return data;
  }, [filteredTransactions]);

  // Calculate totals
  const totalSpending = categoryData.reduce((sum, cat) => sum + cat.value, 0);
  const topCategory = categoryData[0];

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const percentage = ((data.value / totalSpending) * 100).toFixed(1);
    
    return (
      <div className="bg-glass-bg backdrop-blur-sm border border-glass-border rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span>{data.icon}</span>
          <span className="font-medium">{data.name}</span>
        </div>
        <div className="text-sm">
          <span className="text-white">{formatCurrency(data.value)}</span>
          <span className="text-white/50 ml-2">({percentage}%)</span>
        </div>
      </div>
    );
  };

  // Custom legend
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload?.slice(0, 6).map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-white/60">{entry.value}</span>
          </div>
        ))}
        {payload && payload.length > 6 && (
          <span className="text-xs text-white/50">+{payload.length - 6} more</span>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Spending Breakdown</h3>
          <p className="text-sm text-white/60">
            {formatCurrency(totalSpending)} total spending
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex bg-glass-bg rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-all',
                  timeRange === range
                    ? 'bg-neon-primary/20 text-neon-primary'
                    : 'text-white/60 hover:text-white'
                )}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <div className="flex bg-glass-bg rounded-lg p-1">
            <button
              onClick={() => setChartView('pie')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                chartView === 'pie'
                  ? 'bg-neon-primary/20 text-neon-primary'
                  : 'text-white/60 hover:text-white'
              )}
            >
              <PieChartIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setChartView('bar')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                chartView === 'bar'
                  ? 'bg-neon-primary/20 text-neon-primary'
                  : 'text-white/60 hover:text-white'
              )}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {categoryData.length > 0 ? (
        <motion.div
          key={chartView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-glass-bg/30 border border-glass-border p-4"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'pie' ? (
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={renderLegend} />
                </PieChart>
              ) : (
                <BarChart
                  data={categoryData.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    type="number"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    tickFormatter={(value) => formatCompactCurrency(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [formatCurrency(value as number), 'Spent']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryData.slice(0, 8).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-16 rounded-xl bg-glass-bg/30 border border-glass-border">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/50">No spending data for this period</p>
        </div>
      )}

      {/* Top Categories List */}
      {categoryData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white/70">Top Categories</h4>
          <div className="grid gap-2">
            {categoryData.slice(0, 5).map((cat, index) => {
              const percentage = (cat.value / totalSpending) * 100;
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-glass-bg/50 border border-glass-border"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${COLORS[index % COLORS.length]}20` }}
                  >
                    <span>{cat.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate text-white">{cat.name}</span>
                      <span className="text-sm text-white">{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-glass-bg rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-white/50 w-12 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

SpendingBreakdown.displayName = 'SpendingBreakdown';

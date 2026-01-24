'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrivacyMode, useNetWorth, useFinanceSnapshots } from '@/lib/stores/financehub';
import { formatCurrency, formatCompactCurrency } from '@/types/finance';
import type { FinanceSnapshot } from '@/types/finance';

interface NetWorthCardProps {
  className?: string;
}

/**
 * NetWorthCard Component
 *
 * Displays the user's net worth with:
 * - Animated counter (odometer effect)
 * - Trend indicator (up/down/flat)
 * - Mini sparkline of recent history
 * - Privacy blur support
 */
type SparklinePeriod = 7 | 14 | 30;

export function NetWorthCard({ className }: NetWorthCardProps) {
  const privacyMode = usePrivacyMode();
  const netWorth = useNetWorth();
  const snapshots = useFinanceSnapshots();

  // Animated counter state
  const [displayValue, setDisplayValue] = useState(netWorth);
  const displayValueRef = useRef(displayValue);
  displayValueRef.current = displayValue;

  // Sparkline period selector (7, 14, or 30 days)
  const [sparklinePeriod, setSparklinePeriod] = useState<SparklinePeriod>(14);

  // Tooltip state for sparkline hover
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    snapshot: FinanceSnapshot;
    x: number;
    y: number;
  } | null>(null);
  const sparklineRef = useRef<HTMLDivElement>(null);

  // Calculate trend from snapshots
  const lastSnapshot = snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots[snapshots.length - 2];
  const trend =
    lastSnapshot && previousSnapshot
      ? lastSnapshot.netWorth - previousSnapshot.netWorth
      : 0;
  const trendPercent = previousSnapshot?.netWorth
    ? ((trend / previousSnapshot.netWorth) * 100).toFixed(1)
    : '0.0';

  // Format date for display (e.g., "Jan 1")
  const formatShortDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  // Handle bar hover for tooltip
  const handleBarHover = useCallback(
    (e: React.MouseEvent, index: number, snapshot: FinanceSnapshot) => {
      if (!sparklineRef.current) return;
      const rect = sparklineRef.current.getBoundingClientRect();
      setHoveredBar({
        index,
        snapshot,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    []
  );

  const handleBarLeave = useCallback(() => {
    setHoveredBar(null);
  }, []);

  // Animate counter on value change
  useEffect(() => {
    const currentDisplayValue = displayValueRef.current;
    const duration = 1000; // 1 second animation
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = (netWorth - currentDisplayValue) / steps;
    
    if (Math.abs(netWorth - currentDisplayValue) < 1) {
      setDisplayValue(netWorth);
      return;
    }

    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplayValue(netWorth);
        clearInterval(timer);
      } else {
        setDisplayValue((prev) => prev + increment);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [netWorth]);

  // Generate sparkline data from snapshots (configurable period)
  const recentSnapshots = snapshots.slice(-sparklinePeriod);
  const sparklineData = recentSnapshots.map((s) => s.netWorth);
  const sparklineMax = Math.max(...sparklineData, 1);
  const sparklineMin = Math.min(...sparklineData, 0);
  const sparklineRange = sparklineMax - sparklineMin || 1;

  // Period labels for selector
  const periodLabels: Record<SparklinePeriod, string> = {
    7: '7D',
    14: '14D',
    30: '30D',
  };

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-text-muted';

  return (
    <div className={cn('p-4', className)}>
      {/* Label */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted uppercase tracking-wider">
          Net Worth
        </span>
        {snapshots.length > 1 && (
          <div className={cn('flex items-center gap-1 text-xs', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{trend >= 0 ? '+' : ''}{trendPercent}%</span>
          </div>
        )}
      </div>

      {/* Main Value */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span
          className={cn(
            'text-3xl font-bold tracking-tight',
            netWorth >= 0 ? 'text-foreground' : 'text-red-400',
            privacyMode && 'blur-md select-none hover:blur-sm transition-all cursor-pointer'
          )}
          data-privacy={privacyMode ? 'blur' : undefined}
        >
          {privacyMode ? '$•••,•••' : formatCurrency(displayValue)}
        </span>
      </motion.div>

      {/* Sparkline with min/max labels */}
      {sparklineData.length > 1 && !privacyMode && (
        <div className="mt-3">
          {/* Date range header with period selector */}
          <div className="flex items-center justify-between text-[10px] text-text-muted/60 mb-1">
            <div className="flex items-center gap-1">
              <span>{formatShortDate(recentSnapshots[0]?.date || '')}</span>
              <span>-</span>
              <span>{formatShortDate(recentSnapshots[recentSnapshots.length - 1]?.date || '')}</span>
            </div>
            {/* Period selector */}
            <div className="flex items-center gap-0.5 bg-surface-2/50 rounded px-1 py-0.5">
              {([7, 14, 30] as SparklinePeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setSparklinePeriod(period)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
                    sparklinePeriod === period
                      ? 'bg-neon-primary/20 text-neon-primary'
                      : 'text-text-muted hover:text-foreground'
                  )}
                >
                  {periodLabels[period]}
                </button>
              ))}
            </div>
          </div>

          {/* Sparkline with Y-axis labels */}
          <div className="flex gap-1">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between text-[9px] text-text-muted/50 pr-1 h-8">
              <span>{formatCompactCurrency(sparklineMax)}</span>
              <span>{formatCompactCurrency(sparklineMin)}</span>
            </div>

            {/* Bars */}
            <div
              ref={sparklineRef}
              className="flex-1 h-8 flex items-end gap-0.5 relative"
            >
              {sparklineData.map((value, i) => {
                const height = ((value - sparklineMin) / sparklineRange) * 100;
                const isLast = i === sparklineData.length - 1;
                const isHovered = hoveredBar?.index === i;
                return (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 5)}%` }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                    className={cn(
                      'flex-1 rounded-t-sm cursor-pointer transition-colors',
                      isLast
                        ? 'bg-neon-primary'
                        : isHovered
                          ? 'bg-neon-primary/60'
                          : 'bg-border-subtle hover:bg-border-subtle/80'
                    )}
                    onMouseEnter={(e) => {
                      const snapshot = recentSnapshots[i];
                      if (snapshot) handleBarHover(e, i, snapshot);
                    }}
                    onMouseMove={(e) => {
                      const snapshot = recentSnapshots[i];
                      if (snapshot) handleBarHover(e, i, snapshot);
                    }}
                    onMouseLeave={handleBarLeave}
                  />
                );
              })}

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredBar && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute z-10 px-2 py-1 bg-surface-2 border border-border-subtle rounded shadow-lg pointer-events-none"
                    style={{
                      left: Math.min(hoveredBar.x, 120),
                      bottom: '100%',
                      marginBottom: '4px',
                    }}
                  >
                    <div className="text-xs font-medium text-foreground">
                      {formatCurrency(hoveredBar.snapshot.netWorth)}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {formatShortDate(hoveredBar.snapshot.date)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder sparkline when in privacy mode */}
      {sparklineData.length > 1 && privacyMode && (
        <div className="mt-3 h-8 flex items-end gap-0.5 blur-sm">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-border-subtle"
              style={{ height: `${30 + Math.random() * 50}%` }}
            />
          ))}
        </div>
      )}

      {/* Sub-stats */}
      <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
        <span
          className={cn(privacyMode && 'blur-sm')}
          data-privacy={privacyMode ? 'blur' : undefined}
        >
          {privacyMode ? '••••' : formatCompactCurrency(netWorth)} total
        </span>
        {snapshots.length > 0 && (
          <span className="text-text-muted/50">
            {snapshots.length} day history
          </span>
        )}
      </div>
    </div>
  );
}

NetWorthCard.displayName = 'NetWorthCard';

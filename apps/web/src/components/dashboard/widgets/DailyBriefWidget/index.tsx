'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBriefData, useBriefTasks, useQuickActions, getDefaultQuickActions, useDismissedInsights } from './hooks';
import {
  BriefHeader,
  SummarySection,
  QuickActionsBar,
  InsightsList,
  CalendarPreview,
  TasksPreview,
  WeatherCard,
  QuoteFooter,
  EmptyState,
  LoadingSkeleton,
} from './components';
import { BriefCommandCenter } from './expanded';
import { WIDGET_VARIANTS, getTimeOfDay } from './constants';
import type { DailyBriefWidgetProps, Insight } from './types';

export function DailyBriefWidget({ userId, className }: DailyBriefWidgetProps) {
  const timeOfDay = getTimeOfDay();

  // Data hooks
  const {
    brief,
    isLoading,
    isRefreshing,
    error,
    fetchBrief,
    regenerateBrief,
    needsRegeneration,
  } = useBriefData(userId);

  const { executeAction, activeActionId } = useQuickActions();
  const { filterInsights, dismissInsight } = useDismissedInsights();
  const { urgentTasks, todayTasks, toggleTask } = useBriefTasks(brief?.tasks);

  // UI state
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'quickActions', 'insights', 'calendar', 'tasks'])
  );
  const [insightActiveId, setInsightActiveId] = useState<string | null>(null);
  const hasMarkedRead = useRef(false);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Mark as read when expanded (fire once per expansion)
  useEffect(() => {
    if (brief?.generatedAt && isExpanded && !hasMarkedRead.current) {
      hasMarkedRead.current = true;
      fetch('/api/briefs/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType: 'morning_brief' }),
      }).catch(() => {});
    }
    if (!isExpanded) {
      hasMarkedRead.current = false;
    }
  }, [brief?.generatedAt, isExpanded]);

  // Track client mount for portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Dismissed
  if (isDismissed) return null;

  // Loading
  if (isLoading && !brief) {
    return <LoadingSkeleton className={className} />;
  }

  // Empty state
  if (!isLoading && !brief) {
    return (
      <EmptyState
        timeOfDay={timeOfDay}
        isLoading={isRefreshing}
        onGenerate={regenerateBrief}
        className={className}
      />
    );
  }

  // Filter insights
  const visibleInsights: Insight[] = brief?.insights
    ? filterInsights(brief.insights)
    : [];

  return (
    <motion.div
      layout
      initial={WIDGET_VARIANTS.initial}
      animate={WIDGET_VARIANTS.animate}
      exit={WIDGET_VARIANTS.exit}
      className={cn('surface-matte overflow-hidden', className)}
    >
      {/* Header */}
      <BriefHeader
        greeting={brief?.greeting}
        date={brief?.date}
        timeOfDay={timeOfDay}
        isRefreshing={isRefreshing}
        needsRegeneration={needsRegeneration}
        onRefresh={() => fetchBrief(true)}
        onRegenerate={regenerateBrief}
        onDismiss={() => setIsDismissed(true)}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onOpenFullScreen={() => setIsFullScreen(true)}
        isExpanded={isExpanded}
      />

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && brief && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10"
          >
            {/* Upgrade Notice */}
            {needsRegeneration && (
              <div className="p-3 bg-neon-primary/10 border-b border-neon-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neon-primary" />
                    <span className="text-xs text-white/80">
                      New features available! Click Update to get Quick Actions &amp; Insights.
                    </span>
                  </div>
                  <button
                    onClick={regenerateBrief}
                    className="px-2 py-1 text-xs bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary rounded transition-colors"
                  >
                    Update Now
                  </button>
                </div>
              </div>
            )}

            {/* AI Summary */}
            <SummarySection
              summary={brief.summary}
              isOpen={expandedSections.has('summary')}
              onToggle={() => toggleSection('summary')}
            />

            {/* Quick Actions — fall back to defaults for legacy briefs */}
            {(() => {
              const actions = brief.quickActions && brief.quickActions.length > 0
                ? brief.quickActions
                : getDefaultQuickActions(timeOfDay);
              return actions.length > 0 ? (
                <QuickActionsBar
                  actions={actions}
                  onAction={executeAction}
                  activeActionId={activeActionId}
                  isOpen={expandedSections.has('quickActions')}
                  onToggle={() => toggleSection('quickActions')}
                />
              ) : null;
            })()}

            {/* Insights */}
            <InsightsList
              insights={visibleInsights}
              isOpen={expandedSections.has('insights')}
              onToggle={() => toggleSection('insights')}
              activeActionId={insightActiveId}
              onSetActiveAction={setInsightActiveId}
              onDismiss={dismissInsight}
            />

            {/* Calendar */}
            {brief.calendar && brief.calendar.events.length > 0 && (
              <CalendarPreview
                events={brief.calendar.events}
                isOpen={expandedSections.has('calendar')}
                onToggle={() => toggleSection('calendar')}
              />
            )}

            {/* Weather */}
            {brief.weather && (
              <WeatherCard
                weather={brief.weather}
                isOpen={expandedSections.has('weather')}
                onToggle={() => toggleSection('weather')}
              />
            )}

            {/* Tasks — live synced */}
            <TasksPreview
              urgentTasks={urgentTasks}
              todayTasks={todayTasks}
              isOpen={expandedSections.has('tasks')}
              onToggle={() => toggleSection('tasks')}
              onToggleTask={toggleTask}
            />

            {/* Quote */}
            {brief.quote && <QuoteFooter quote={brief.quote} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Command Center - Portal to body */}
      {mounted &&
        isFullScreen &&
        createPortal(
          <BriefCommandCenter
            onClose={() => setIsFullScreen(false)}
            userId={userId}
          />,
          document.body
        )}
    </motion.div>
  );
}

DailyBriefWidget.displayName = 'DailyBriefWidget';
export default DailyBriefWidget;

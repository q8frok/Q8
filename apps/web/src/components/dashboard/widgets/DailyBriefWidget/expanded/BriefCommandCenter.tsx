'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minimize2,
  RefreshCw,
  Sparkles,
  Calendar,
  CheckSquare,
  Cloud,
  Lightbulb,
  MessageSquare,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  QuickActionsBar,
  InsightsList,
  CalendarPreview,
  TasksPreview,
} from '../components';
import { GREETING_ICONS, getTimeOfDay } from '../constants';
import { useBriefData, useBriefTasks, useQuickActions, getDefaultQuickActions, useDismissedInsights } from '../hooks';
import type { Insight } from '../types';

type BriefTab = 'overview' | 'calendar' | 'tasks' | 'insights';

const BRIEF_TABS: { id: BriefTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'insights', label: 'Insights', icon: '💡' },
];

interface BriefCommandCenterProps {
  onClose: () => void;
  userId: string;
}

export function BriefCommandCenter({ onClose, userId }: BriefCommandCenterProps) {
  const timeOfDay = getTimeOfDay();
  const GreetingIcon = GREETING_ICONS[timeOfDay];
  const [activeTab, setActiveTab] = useState<BriefTab>('overview');

  const {
    brief,
    isRefreshing,
    needsRegeneration,
    fetchBrief,
    regenerateBrief,
  } = useBriefData(userId);

  const { executeAction, activeActionId } = useQuickActions();
  const { filterInsights, dismissInsight } = useDismissedInsights();
  const { urgentTasks, todayTasks, toggleTask } = useBriefTasks(brief?.tasks);

  const visibleInsights: Insight[] = brief?.insights
    ? filterInsights(brief.insights)
    : [];

  const quickActions = brief?.quickActions && brief.quickActions.length > 0
    ? brief.quickActions
    : getDefaultQuickActions(timeOfDay);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-purple-500/10 pointer-events-none" />

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <Minimize2 className="h-5 w-5" />
      </Button>

      <div className="relative h-full overflow-y-auto scrollbar-thin">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                <GreetingIcon className="h-7 w-7 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {brief?.greeting || 'Daily Brief'}
                </h1>
                <p className="text-white/60 mt-1">{brief?.date}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {needsRegeneration && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={regenerateBrief}
                  disabled={isRefreshing}
                  className="text-neon-primary hover:text-neon-primary/80 gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  Update Brief
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchBrief(true)}
                disabled={isRefreshing}
                className="text-white/70 hover:text-white"
              >
                <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-white/10 pb-2 overflow-x-auto scrollbar-thin">
            {BRIEF_TABS.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-shrink-0',
                  activeTab === tab.id
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'text-white/70 hover:text-white'
                )}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
                {tab.id === 'insights' && visibleInsights.length > 0 && (
                  <span className="ml-1.5 text-xs bg-amber-500/30 text-amber-300 px-1.5 rounded-full">
                    {visibleInsights.length}
                  </span>
                )}
                {tab.id === 'tasks' && urgentTasks.length > 0 && (
                  <span className="ml-1.5 text-xs bg-red-500/30 text-red-300 px-1.5 rounded-full">
                    {urgentTasks.length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && brief && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column — Summary + Actions */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* AI Summary */}
                    <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-amber-400" />
                        <h3 className="text-sm font-medium text-white/80">AI Summary</h3>
                      </div>
                      <p className="text-white/90 text-sm leading-relaxed whitespace-pre-line">
                        {brief.summary}
                      </p>
                    </div>

                    {/* Quick Actions */}
                    {quickActions.length > 0 && (
                      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-purple-400" />
                          <h3 className="text-sm font-medium text-white/80">Quick Actions</h3>
                        </div>
                        <QuickActionsBar
                          actions={quickActions}
                          onAction={executeAction}
                          activeActionId={activeActionId}
                          isOpen={true}
                          onToggle={() => {}}
                        />
                      </div>
                    )}

                    {/* Calendar Preview */}
                    {brief.calendar && brief.calendar.events.length > 0 && (
                      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-white/80">
                            Today&apos;s Schedule ({brief.calendar.events.length} events)
                          </h3>
                        </div>
                        <CalendarPreview
                          events={brief.calendar.events}
                          isOpen={true}
                          onToggle={() => {}}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Column — Side panels */}
                  <div className="space-y-4">
                    {/* Weather */}
                    {brief.weather && (
                      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Cloud className="h-4 w-4 text-sky-400" />
                          <h3 className="text-sm font-medium text-white/80">Weather</h3>
                        </div>
                        <div className="text-center">
                          <div className="text-4xl font-bold text-white">
                            {Math.round(brief.weather.temp)}°
                          </div>
                          <p className="text-white/60 capitalize mt-1">{brief.weather.description}</p>
                          <div className="flex justify-center gap-4 mt-2 text-xs text-white/50">
                            <span>H: {Math.round(brief.weather.high)}°</span>
                            <span>L: {Math.round(brief.weather.low)}°</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tasks Summary */}
                    <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-medium text-white/80">Tasks</h3>
                      </div>
                      {urgentTasks.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-red-400 font-medium mb-1.5">
                            {urgentTasks.length} Urgent
                          </p>
                          {urgentTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className="text-xs text-white/70 py-1 border-b border-white/5 last:border-0"
                            >
                              {task.title}
                            </div>
                          ))}
                        </div>
                      )}
                      {todayTasks.length > 0 && (
                        <div>
                          <p className="text-xs text-white/50 font-medium mb-1.5">
                            {todayTasks.length} Due Today
                          </p>
                          {todayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className="text-xs text-white/70 py-1 border-b border-white/5 last:border-0"
                            >
                              {task.title}
                            </div>
                          ))}
                        </div>
                      )}
                      {urgentTasks.length === 0 && todayTasks.length === 0 && (
                        <p className="text-xs text-white/40 text-center py-2">No tasks due today</p>
                      )}
                    </div>

                    {/* Top Insights */}
                    {visibleInsights.length > 0 && (
                      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="h-4 w-4 text-amber-400" />
                          <h3 className="text-sm font-medium text-white/80">
                            Insights ({visibleInsights.length})
                          </h3>
                        </div>
                        {visibleInsights.slice(0, 3).map((insight) => (
                          <div
                            key={insight.id}
                            className="text-xs text-white/70 py-1.5 border-b border-white/5 last:border-0"
                          >
                            <span className="font-medium text-white/90">{insight.title}</span>
                            <p className="text-white/50 mt-0.5">{insight.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quote */}
                    {brief.quote && (
                      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                        <Quote className="h-4 w-4 text-white/30 mb-2" />
                        <p className="text-xs text-white/70 italic leading-relaxed">
                          &ldquo;{brief.quote.text}&rdquo;
                        </p>
                        <p className="text-xs text-white/40 mt-1.5">— {brief.quote.author}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && brief?.calendar && (
                <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    <h3 className="text-lg font-medium text-white">Today&apos;s Schedule</h3>
                  </div>
                  {brief.calendar.summary && (
                    <p className="text-sm text-white/60 mb-4">{brief.calendar.summary}</p>
                  )}
                  <CalendarPreview
                    events={brief.calendar.events}
                    isOpen={true}
                    onToggle={() => {}}
                  />
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckSquare className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-white">Tasks</h3>
                  </div>
                  <TasksPreview
                    urgentTasks={urgentTasks}
                    todayTasks={todayTasks}
                    isOpen={true}
                    onToggle={() => {}}
                    onToggleTask={toggleTask}
                  />
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="h-5 w-5 text-amber-400" />
                    <h3 className="text-lg font-medium text-white">
                      AI Insights ({visibleInsights.length})
                    </h3>
                  </div>
                  <InsightsList
                    insights={visibleInsights}
                    isOpen={true}
                    onToggle={() => {}}
                    activeActionId={null}
                    onSetActiveAction={() => {}}
                    onDismiss={dismissInsight}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

BriefCommandCenter.displayName = 'BriefCommandCenter';

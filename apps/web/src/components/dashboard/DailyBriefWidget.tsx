'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  Sunset,
  Calendar,
  CloudSun,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Quote,
  Sparkles,
  X,
  Zap,
  Lightbulb,
  Bell,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Home,
  Search,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSendToChat } from '@/contexts/ChatContext';
import type { DailyBriefContent, QuickAction, Insight } from '@/lib/agents/proactive/morning-brief';

interface DailyBriefWidgetProps {
  userId: string;
  className?: string;
}

// LocalStorage key for dismissed insights
const DISMISSED_INSIGHTS_KEY = 'q8_dismissed_insights';
const DISMISSAL_EXPIRY_DAYS = 7;

interface DismissalRecord {
  id: string;
  dismissedAt: number;
}

/**
 * Get dismissed insight IDs from localStorage
 */
function getDismissedInsights(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    if (!stored) return new Set();

    const records: DismissalRecord[] = JSON.parse(stored);
    const now = Date.now();
    const expiryMs = DISMISSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    // Filter out expired dismissals
    const validRecords = records.filter(
      (record) => now - record.dismissedAt < expiryMs
    );

    // Update storage if we filtered some out
    if (validRecords.length !== records.length) {
      localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(validRecords));
    }

    return new Set(validRecords.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/**
 * Mark an insight as dismissed
 */
function dismissInsight(insightId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    const records: DismissalRecord[] = stored ? JSON.parse(stored) : [];

    if (records.some((r) => r.id === insightId)) return;

    records.push({ id: insightId, dismissedAt: Date.now() });
    const trimmedRecords = records.slice(-100);

    localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(trimmedRecords));
  } catch {
    // Ignore errors
  }
}

/**
 * Get time-aware icon for greeting
 */
function getGreetingIcon(timeOfDay: string) {
  switch (timeOfDay) {
    case 'morning':
      return Sun;
    case 'afternoon':
      return CloudSun;
    case 'evening':
      return Sunset;
    case 'night':
      return Moon;
    default:
      return Sun;
  }
}

/**
 * Get icon for quick action
 */
function getQuickActionIcon(icon: QuickAction['icon']) {
  const icons = {
    calendar: Calendar,
    task: CheckSquare,
    weather: CloudSun,
    chat: MessageSquare,
    home: Home,
    search: Search,
  };
  return icons[icon] || Zap;
}

/**
 * Get icon for insight type
 */
function getInsightIcon(type: Insight['type']) {
  const icons = {
    tip: Lightbulb,
    reminder: Bell,
    'follow-up': MessageSquare,
    alert: AlertTriangle,
    recommendation: Sparkles,
  };
  return icons[type] || Lightbulb;
}

/**
 * Get color for insight priority
 */
function getInsightPriorityColor(priority: Insight['priority']) {
  switch (priority) {
    case 'high':
      return 'border-red-500/30 bg-red-500/10 text-red-400';
    case 'medium':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'low':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    default:
      return 'border-white/10 bg-white/5 text-white/60';
  }
}

/**
 * Get priority indicator
 */
function getPriorityIndicator(priority: Insight['priority']) {
  switch (priority) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '';
  }
}

/**
 * Daily Brief Widget
 * Displays the daily briefing with quick actions and insights in a collapsible glass panel
 */
export function DailyBriefWidget({ userId, className }: DailyBriefWidgetProps) {
  const sendToChat = useSendToChat();
  const [brief, setBrief] = useState<DailyBriefContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(() => getDismissedInsights());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'quickActions', 'insights', 'calendar'])
  );
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Determine time of day for icon
  const getTimeOfDay = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }, []);

  const GreetingIcon = getGreetingIcon(getTimeOfDay());

  // Fetch the latest brief
  const fetchBrief = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const response = await fetch('/api/briefs/latest');
      if (response.ok) {
        const data = await response.json();
        if (data.brief) {
          setBrief(data.brief);
        }
      }
    } catch (error) {
      console.error('Failed to fetch daily brief:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Regenerate the brief (creates a new one with latest features)
  const regenerateBrief = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/cron/morning-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchBrief();
      }
    } catch (error) {
      console.error('Failed to regenerate brief:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBrief]);

  // Check if brief is missing new features (quickActions/insights)
  const needsRegeneration = brief && (!brief.quickActions || !brief.insights);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief, userId]);

  // Periodic refresh for insights (every 30 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBrief(true);
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchBrief]);

  // Mark as read when expanded
  useEffect(() => {
    if (brief && isExpanded) {
      fetch('/api/briefs/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType: 'morning_brief' }),
      }).catch(() => {});
    }
  }, [brief, isExpanded]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Handle quick action click
  const handleQuickAction = useCallback((action: QuickAction) => {
    sendToChat(action.action);
    setActionFeedback(action.id);
    setTimeout(() => setActionFeedback(null), 1500);
  }, [sendToChat]);

  // Handle insight action click
  const handleInsightAction = useCallback((insight: Insight) => {
    if (insight.action) {
      sendToChat(insight.action.message);
      setActionFeedback(insight.id);
      setTimeout(() => setActionFeedback(null), 1500);
    }
  }, [sendToChat]);

  // Handle insight dismiss
  const handleDismissInsight = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissInsight(id);
    setDismissedInsights((prev) => new Set([...prev, id]));
  }, []);

  if (isDismissed) {
    return null;
  }

  // Filter out dismissed insights
  const visibleInsights = (brief?.insights || []).filter(
    (insight) => !dismissedInsights.has(insight.id)
  );

  // Empty state when no brief exists
  if (!isLoading && !brief) {
    return (
      <div className={cn('surface-matte p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <GreetingIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Daily Brief</h3>
              <p className="text-xs text-white/60">No brief generated yet today</p>
            </div>
          </div>
          <button
            onClick={async () => {
              setIsLoading(true);
              try {
                const res = await fetch('/api/cron/morning-brief', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (res.ok) {
                  await fetchBrief();
                }
              } catch (error) {
                console.error('Failed to generate brief:', error);
              } finally {
                setIsLoading(false);
              }
            }}
            className="px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition-colors"
          >
            Generate Now
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('surface-matte p-4 animate-pulse', className)}>
        <div className="h-6 w-48 bg-white/10 rounded mb-2" />
        <div className="h-4 w-full bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('surface-matte overflow-hidden', className)}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <GreetingIcon className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{brief?.greeting}</h3>
            <p className="text-xs text-white/60">{brief?.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {needsRegeneration && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                regenerateBrief();
              }}
              className="px-2 py-1 text-xs bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary rounded-lg transition-colors flex items-center gap-1"
              aria-label="Regenerate brief with new features"
            >
              <Sparkles className="w-3 h-3" />
              Update
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              needsRegeneration ? regenerateBrief() : fetchBrief(true);
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label={needsRegeneration ? "Regenerate brief" : "Refresh brief"}
          >
            <RefreshCw className={cn("w-4 h-4 text-white/40", isLoading && "animate-spin")} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Dismiss brief"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-white/60" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/60" />
          )}
        </div>
      </div>

      {/* Content */}
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
                      New features available! Click Update to get Quick Actions & Insights.
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
            <Section
              icon={<Sparkles className="w-4 h-4 text-purple-400" />}
              title="Today's Summary"
              isOpen={expandedSections.has('summary')}
              onToggle={() => toggleSection('summary')}
            >
              <p className="text-sm text-white/80 leading-relaxed">{brief.summary}</p>
            </Section>

            {/* Quick Actions */}
            {brief.quickActions && brief.quickActions.length > 0 && (
              <Section
                icon={<Zap className="w-4 h-4 text-yellow-400" />}
                title="Quick Actions"
                isOpen={expandedSections.has('quickActions')}
                onToggle={() => toggleSection('quickActions')}
              >
                <div className="flex flex-wrap gap-2">
                  {brief.quickActions.map((action) => {
                    const Icon = getQuickActionIcon(action.icon);
                    const isActive = actionFeedback === action.id;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleQuickAction(action)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          'bg-white/5 hover:bg-neon-primary/20 border border-white/10 hover:border-neon-primary/30',
                          isActive && 'bg-neon-primary/30 border-neon-primary/50'
                        )}
                      >
                        {isActive ? (
                          <Send className="w-3 h-3 text-neon-primary" />
                        ) : (
                          <Icon className="w-3 h-3 text-white/60" />
                        )}
                        <span className="text-white/80">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Insights */}
            {visibleInsights.length > 0 && (
              <Section
                icon={<Lightbulb className="w-4 h-4 text-cyan-400" />}
                title="Insights"
                badge={`${visibleInsights.length}`}
                isOpen={expandedSections.has('insights')}
                onToggle={() => toggleSection('insights')}
              >
                <div className="space-y-2">
                  {visibleInsights.slice(0, 5).map((insight) => {
                    const Icon = getInsightIcon(insight.type);
                    const isActive = actionFeedback === insight.id;
                    return (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-lg border cursor-pointer group',
                          'hover:bg-white/5 transition-colors',
                          getInsightPriorityColor(insight.priority),
                          isActive && 'ring-1 ring-neon-primary/50'
                        )}
                        onClick={() => handleInsightAction(insight)}
                      >
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs">{getPriorityIndicator(insight.priority)}</span>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-medium text-white/90 truncate">
                              {insight.title}
                            </h4>
                            {insight.dismissible && (
                              <button
                                onClick={(e) => handleDismissInsight(insight.id, e)}
                                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all flex-shrink-0"
                                aria-label="Dismiss insight"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-white/60 line-clamp-2">
                            {insight.description}
                          </p>
                          {insight.action && (
                            <span className="text-[10px] text-neon-primary/80 mt-1 inline-flex items-center gap-1">
                              <Send className="w-2.5 h-2.5" />
                              {insight.action.label}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Calendar */}
            {brief.calendar && brief.calendar.events.length > 0 && (
              <Section
                icon={<Calendar className="w-4 h-4 text-blue-400" />}
                title="Calendar"
                badge={`${brief.calendar.events.length} events`}
                isOpen={expandedSections.has('calendar')}
                onToggle={() => toggleSection('calendar')}
              >
                <div className="space-y-2">
                  {brief.calendar.events.slice(0, 5).map((event, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-white/50 font-mono text-xs w-16 shrink-0">
                        {event.time}
                      </span>
                      <div>
                        <p className="text-white/90">{event.title}</p>
                        {event.location && (
                          <p className="text-white/50 text-xs">{event.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Weather */}
            {brief.weather && (
              <Section
                icon={<CloudSun className="w-4 h-4 text-cyan-400" />}
                title="Weather"
                isOpen={expandedSections.has('weather')}
                onToggle={() => toggleSection('weather')}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-light text-white">
                    {brief.weather.temp}°F
                  </span>
                  <div className="text-sm text-white/70">
                    <p>{brief.weather.condition}</p>
                    <p className="text-xs text-white/50">
                      H: {brief.weather.high}° L: {brief.weather.low}°
                    </p>
                  </div>
                </div>
              </Section>
            )}

            {/* Tasks */}
            {brief.tasks && (brief.tasks.urgent.length > 0 || brief.tasks.today.length > 0) && (
              <Section
                icon={<CheckSquare className="w-4 h-4 text-green-400" />}
                title="Tasks"
                isOpen={expandedSections.has('tasks')}
                onToggle={() => toggleSection('tasks')}
              >
                <div className="space-y-2">
                  {brief.tasks.urgent.map((task, i) => (
                    <div key={`urgent-${i}`} className="flex items-center gap-2 text-sm">
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                        Urgent
                      </span>
                      <span className="text-white/80">{task}</span>
                    </div>
                  ))}
                  {brief.tasks.today.map((task, i) => (
                    <div key={`today-${i}`} className="flex items-center gap-2 text-sm">
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                        Today
                      </span>
                      <span className="text-white/80">{task}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Quote */}
            {brief.quote && (
              <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <Quote className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/70 italic">&ldquo;{brief.quote.text}&rdquo;</p>
                    <p className="text-xs text-white/40 mt-1">— {brief.quote.author}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Collapsible Section Component
 */
function Section({
  icon,
  title,
  badge,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-white/90">{title}</span>
          {badge && (
            <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DailyBriefWidget;

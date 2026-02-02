import {
  Sun,
  Moon,
  Sunset,
  CloudSun,
  Calendar,
  CheckSquare,
  MessageSquare,
  Home,
  Search,
  Zap,
  Lightbulb,
  Bell,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { QuickActionIconType, InsightType, InsightPriority, TimeOfDay } from './types';

// =============================================================================
// ICON MAPS
// =============================================================================

export const GREETING_ICONS: Record<TimeOfDay, typeof Sun> = {
  morning: Sun,
  afternoon: CloudSun,
  evening: Sunset,
  night: Moon,
};

export const QUICK_ACTION_ICONS: Record<QuickActionIconType, typeof Zap> = {
  calendar: Calendar,
  task: CheckSquare,
  weather: CloudSun,
  chat: MessageSquare,
  home: Home,
  search: Search,
};

export const INSIGHT_ICONS: Record<InsightType, typeof Lightbulb> = {
  tip: Lightbulb,
  reminder: Bell,
  'follow-up': MessageSquare,
  alert: AlertTriangle,
  recommendation: Sparkles,
};

// =============================================================================
// COLOR MAPS
// =============================================================================

export const INSIGHT_PRIORITY_STYLES: Record<InsightPriority, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

export const PRIORITY_INDICATORS: Record<InsightPriority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

export const TASK_PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-blue-500/20 text-blue-400',
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

export const WIDGET_VARIANTS = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const SECTION_VARIANTS = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto' as const, opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

export const INSIGHT_VARIANTS = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 10 },
};

// =============================================================================
// CONFIG
// =============================================================================

export const BRIEF_CONFIG = {
  REFRESH_INTERVAL_MS: 30 * 60 * 1000, // 30 minutes
  MAX_CALENDAR_EVENTS: 5,
  MAX_INSIGHTS: 5,
  ACTION_FEEDBACK_MS: 1500,
};

export const DISMISSED_INSIGHTS_KEY = 'q8_dismissed_insights';
export const DISMISSAL_EXPIRY_DAYS = 7;
export const MAX_DISMISSED_RECORDS = 100;

// =============================================================================
// HELPERS
// =============================================================================

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

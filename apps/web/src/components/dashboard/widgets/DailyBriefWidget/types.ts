import type { WidgetId, WidgetActionType } from '@/contexts/WidgetUpdateContext';

// =============================================================================
// ENUMS & LITERAL TYPES
// =============================================================================

export type QuickActionIconType = 'calendar' | 'task' | 'weather' | 'chat' | 'home' | 'search';
export type QuickActionType = 'chat' | 'navigate' | 'widget-action';
export type InsightType = 'tip' | 'reminder' | 'follow-up' | 'alert' | 'recommendation';
export type InsightPriority = 'high' | 'medium' | 'low';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

// =============================================================================
// DATA MODELS
// =============================================================================

export interface QuickAction {
  id: string;
  label: string;
  icon: QuickActionIconType;
  type: QuickActionType;
  /** For 'chat' type — message to send to chat */
  chatMessage?: string;
  /** For 'navigate' type — widget to open */
  navigateTo?: { widget: WidgetId; view?: string };
  /** For 'widget-action' type — trigger widget action */
  widgetAction?: { widgetId: WidgetId; action: WidgetActionType; data?: Record<string, unknown> };
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  priority: InsightPriority;
  dismissible: boolean;
  action?: {
    label: string;
    message: string;
  };
}

export interface BriefTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  isUrgent: boolean;
}

export interface BriefTasksData {
  urgent: BriefTask[];
  today: BriefTask[];
  totalActive: number;
}

export interface CalendarEvent {
  title: string;
  time: string;
  location?: string;
  isAllDay?: boolean;
}

export interface WeatherData {
  temp: number;
  condition: string;
  high: number;
  low: number;
  description: string;
}

export interface Quote {
  text: string;
  author: string;
}

export interface DailyBriefContent {
  greeting: string;
  date: string;
  summary: string;
  calendar: {
    events: CalendarEvent[];
    summary: string;
  };
  weather?: WeatherData;
  tasks?: BriefTasksData | LegacyTasksData;
  quote?: Quote;
  quickActions?: QuickAction[] | LegacyQuickAction[];
  insights?: Insight[];
  generatedAt: string;
  refreshedAt?: string;
  nextRefresh?: string;
}

/** Legacy format stored in existing briefs */
export interface LegacyTasksData {
  urgent: string[];
  today: string[];
}

/** Legacy quick action format (chat-only) */
export interface LegacyQuickAction {
  id: string;
  label: string;
  action: string;
  icon: QuickActionIconType;
}

// =============================================================================
// WIDGET PROPS
// =============================================================================

export interface DailyBriefWidgetProps {
  userId: string;
  className?: string;
}

export interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export interface BriefHeaderProps {
  greeting?: string;
  date?: string;
  timeOfDay: TimeOfDay;
  isRefreshing: boolean;
  needsRegeneration: boolean;
  onRefresh: () => void;
  onRegenerate: () => void;
  onDismiss: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
}

export interface QuickActionsBarProps {
  actions: QuickAction[];
  onAction: (action: QuickAction) => void;
  activeActionId: string | null;
}

export interface TasksPreviewProps {
  urgentTasks: BriefTask[];
  todayTasks: BriefTask[];
  isOpen: boolean;
  onToggle: () => void;
  onToggleTask: (taskId: string) => void;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

export interface UseBriefDataReturn {
  brief: DailyBriefContent | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  fetchBrief: (isRefresh?: boolean) => Promise<void>;
  regenerateBrief: () => Promise<void>;
  needsRegeneration: boolean;
}

export interface UseBriefTasksReturn {
  tasks: BriefTask[];
  urgentTasks: BriefTask[];
  todayTasks: BriefTask[];
  isLoading: boolean;
  toggleTask: (taskId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export interface UseQuickActionsReturn {
  executeAction: (action: QuickAction | LegacyQuickAction) => void;
  activeActionId: string | null;
}

export interface UseDismissedInsightsReturn {
  dismissedIds: Set<string>;
  dismissInsight: (id: string) => void;
  filterInsights: (insights: Insight[]) => Insight[];
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isLegacyTasksData(tasks: unknown): tasks is LegacyTasksData {
  if (!tasks || typeof tasks !== 'object') return false;
  const t = tasks as Record<string, unknown>;
  return Array.isArray(t.urgent) && t.urgent.length > 0 && typeof t.urgent[0] === 'string';
}

export function isLegacyQuickAction(action: unknown): action is LegacyQuickAction {
  if (!action || typeof action !== 'object') return false;
  return 'action' in (action as Record<string, unknown>) && !('type' in (action as Record<string, unknown>));
}

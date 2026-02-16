import type { WidgetQuickAction } from '@/components/shared/WidgetActionBar';

export interface WidgetActionConfig {
  widgetLabel: string;
  context: Record<string, unknown>;
  quickActions: WidgetQuickAction[];
}

export function buildTaskWidgetActionConfig(params: {
  pendingCount: number;
  totalCount: number;
  showingCompleted: boolean;
}): WidgetActionConfig {
  return {
    widgetLabel: 'Tasks',
    context: params,
    quickActions: [
      {
        id: 'prioritize',
        label: 'Prioritize',
        prompt: 'Prioritize my current tasks and suggest top 3 for today.',
      },
      {
        id: 'plan-day',
        label: 'Plan day',
        prompt: 'Build a realistic execution plan for today from my current tasks.',
      },
    ],
  };
}

export function buildCalendarWidgetActionConfig(params: {
  compactView: string;
  eventsVisible: number;
  todayEvents: number;
  nextEvent: { title: string; startsAt: string } | null;
}): WidgetActionConfig {
  return {
    widgetLabel: 'Calendar',
    context: params,
    quickActions: [
      {
        id: 'summarize-day',
        label: 'Summarize day',
        prompt: 'Summarize my day from calendar and flag schedule risks.',
      },
      {
        id: 'prep-next',
        label: 'Prep next meeting',
        prompt: 'Help me prep for my next meeting with a quick briefing and checklist.',
      },
    ],
  };
}

export function buildDailyBriefWidgetActionConfig(params: {
  timeOfDay: string;
  urgentTasks: number;
  todayTasks: number;
  insightCount: number;
}): WidgetActionConfig {
  return {
    widgetLabel: 'Daily Brief',
    context: params,
    quickActions: [
      {
        id: 'top-priorities',
        label: 'Top priorities',
        prompt: 'From my daily brief, give me the top 3 priorities and why.',
      },
      {
        id: 'risk-scan',
        label: 'Risk scan',
        prompt: 'Scan my daily brief for delivery risks and suggest mitigations.',
      },
    ],
  };
}

export function buildWorkOpsWidgetActionConfig(params: {
  pendingReplies: number;
  staffingFlags: number;
  stockoutRisks: number;
  connectors: number;
  nextAction: string | null;
}): WidgetActionConfig {
  return {
    widgetLabel: 'Work Ops',
    context: params,
    quickActions: [
      {
        id: 'ops-plan',
        label: 'Ops plan',
        prompt: 'Build an operations plan for today based on current work ops metrics.',
      },
      {
        id: 'reply-priorities',
        label: 'Reply priorities',
        prompt: 'Prioritize pending reservation or client replies and draft responses.',
      },
    ],
  };
}

export function buildAlertsWidgetActionConfig(params: {
  activeThresholds: number;
  topAlerts: number;
  criticalCount: number;
}): WidgetActionConfig {
  return {
    widgetLabel: 'Risk & Alerts',
    context: params,
    quickActions: [
      {
        id: 'triage-alerts',
        label: 'Triage alerts',
        prompt: 'Triage current alerts by urgency and propose immediate actions.',
      },
      {
        id: 'prevention-plan',
        label: 'Prevention plan',
        prompt: 'Suggest a short prevention plan to reduce recurrence of these alerts.',
      },
    ],
  };
}

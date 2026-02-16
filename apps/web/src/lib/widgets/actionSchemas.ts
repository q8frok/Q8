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
        id: 'sync-calendar',
        label: 'Sync now',
        prompt: 'Calendar sync has been triggered. Review what changed and call out scheduling conflicts.',
        execution: {
          kind: 'workflow',
          request: {
            url: '/api/calendar/sync',
            method: 'POST',
          },
          onSuccessPrompt:
            'Calendar sync completed. Review new/updated events and surface any conflicts or prep needs.',
        },
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
        id: 'run-ingest',
        label: 'Run ingest',
        prompt: 'Work Ops ingest finished. Summarize what changed and what requires action now.',
        execution: {
          kind: 'workflow',
          request: {
            url: '/api/lifeos/ingest/work-ops',
            method: 'POST',
          },
          onSuccessPrompt:
            'Work Ops ingest completed. Summarize updated operational risks, replies, and next actions.',
        },
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
        id: 'generate-alerts',
        label: 'Generate',
        prompt: 'Alerts were regenerated. Triage the latest alert set and recommend immediate actions.',
        execution: {
          kind: 'workflow',
          request: {
            url: '/api/lifeos/alerts/generate',
            method: 'POST',
          },
          onSuccessPrompt:
            'Alerts were regenerated. Triage the latest alerts by urgency and suggest next actions.',
        },
      },
      {
        id: 'prevention-plan',
        label: 'Prevention plan',
        prompt: 'Suggest a short prevention plan to reduce recurrence of these alerts.',
      },
    ],
  };
}

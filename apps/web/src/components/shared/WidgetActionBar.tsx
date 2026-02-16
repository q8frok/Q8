'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSendToChat } from '@/contexts/ChatContext';
import { AskQ8Button } from './AskQ8Button';

export type WidgetQuickActionExecution =
  | {
      kind?: 'chat';
    }
  | {
      kind: 'workflow';
      request: {
        url: string;
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: Record<string, unknown>;
      };
      onSuccessPrompt?: string;
      onErrorPrompt?: string;
    };

export interface WidgetQuickAction {
  id: string;
  label: string;
  prompt: string;
  context?: Record<string, unknown>;
  execution?: WidgetQuickActionExecution;
}

interface WidgetActionBarProps {
  widgetLabel: string;
  context: Record<string, unknown>;
  quickActions?: WidgetQuickAction[];
  className?: string;
}

/**
 * WidgetActionBar
 *
 * Consistent interaction bar for dashboard widgets:
 * - Ask Q8 with rich widget context
 * - One-click quick actions that dispatch to chat
 * - Optional deterministic workflow execution via API endpoints
 */
export function WidgetActionBar({
  widgetLabel,
  context,
  quickActions = [],
  className,
}: WidgetActionBarProps) {
  const sendToChat = useSendToChat();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const basePrompt = useMemo(
    () => `Help me with ${widgetLabel.toLowerCase()} and suggest the best next action.`,
    [widgetLabel]
  );

  const runWorkflowAction = async (action: WidgetQuickAction) => {
    const execution = action.execution;
    if (!execution || execution.kind !== 'workflow') {
      return false;
    }

    const { request, onSuccessPrompt, onErrorPrompt } = execution;

    try {
      const res = await fetch(request.url, {
        method: request.method ?? 'POST',
        headers: request.body ? { 'Content-Type': 'application/json' } : undefined,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      if (!res.ok) {
        throw new Error(`Workflow failed (${res.status})`);
      }

      if (onSuccessPrompt) {
        sendToChat(onSuccessPrompt, {
          widget: widgetLabel,
          actionId: action.id,
          ...context,
          ...(action.context ?? {}),
        });
      }

      return true;
    } catch {
      sendToChat(
        onErrorPrompt ??
          `I triggered ${action.label} in ${widgetLabel}, but the workflow failed. Please diagnose and guide the next best fallback.`,
        {
          widget: widgetLabel,
          actionId: action.id,
          ...context,
          ...(action.context ?? {}),
        }
      );

      return false;
    }
  };

  const handleQuickAction = async (action: WidgetQuickAction) => {
    if (pendingActionId) return;

    setPendingActionId(action.id);
    try {
      const wasWorkflowHandled = await runWorkflowAction(action);
      if (!wasWorkflowHandled) {
        sendToChat(action.prompt, {
          widget: widgetLabel,
          ...(action.context ?? {}),
          ...context,
        });
      }
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {quickActions.map((action) => {
        const isPending = pendingActionId === action.id;
        return (
          <button
            key={action.id}
            onClick={() => void handleQuickAction(action)}
            disabled={Boolean(pendingActionId)}
            className={cn(
              'inline-flex items-center rounded-lg px-2 py-1 text-xs gap-1',
              'bg-surface-3 hover:bg-surface-2 text-text-secondary hover:text-text-primary',
              'border border-border-subtle transition-colors',
              'disabled:opacity-60 disabled:cursor-not-allowed'
            )}
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {action.label}
          </button>
        );
      })}

      <AskQ8Button
        context={{ widget: widgetLabel, ...context }}
        prompt={basePrompt}
        label="Ask Q8"
        onAsk={sendToChat}
        size="sm"
        disabled={Boolean(pendingActionId)}
      />
    </div>
  );
}

WidgetActionBar.displayName = 'WidgetActionBar';

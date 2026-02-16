'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSendToChat } from '@/contexts/ChatContext';
import { AskQ8Button } from './AskQ8Button';

export interface WidgetQuickAction {
  id: string;
  label: string;
  prompt: string;
  context?: Record<string, unknown>;
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
 */
export function WidgetActionBar({
  widgetLabel,
  context,
  quickActions = [],
  className,
}: WidgetActionBarProps) {
  const sendToChat = useSendToChat();

  const basePrompt = useMemo(
    () => `Help me with ${widgetLabel.toLowerCase()} and suggest the best next action.`,
    [widgetLabel]
  );

  const handleQuickAction = (action: WidgetQuickAction) => {
    sendToChat(action.prompt, {
      widget: widgetLabel,
      ...(action.context ?? {}),
      ...context,
    });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {quickActions.map((action) => (
        <button
          key={action.id}
          onClick={() => handleQuickAction(action)}
          className={cn(
            'inline-flex items-center rounded-lg px-2 py-1 text-xs',
            'bg-surface-3 hover:bg-surface-2 text-text-secondary hover:text-text-primary',
            'border border-border-subtle transition-colors'
          )}
        >
          {action.label}
        </button>
      ))}

      <AskQ8Button
        context={{ widget: widgetLabel, ...context }}
        prompt={basePrompt}
        label="Ask Q8"
        onAsk={sendToChat}
        size="sm"
      />
    </div>
  );
}

WidgetActionBar.displayName = 'WidgetActionBar';

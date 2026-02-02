'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSendToChat } from '@/contexts/ChatContext';
import { useOptionalWidgetUpdates } from '@/contexts/WidgetUpdateContext';
import { BRIEF_CONFIG } from '../constants';
import type {
  QuickAction,
  LegacyQuickAction,
  UseQuickActionsReturn,
  TimeOfDay,
} from '../types';
import { isLegacyQuickAction } from '../types';

/**
 * Normalize legacy quick actions (chat-only) to new typed format
 */
function normalizeLegacyAction(action: LegacyQuickAction): QuickAction {
  // Map known actions to navigation where possible
  const navigateMap: Record<string, QuickAction['navigateTo']> = {
    "What's on my calendar today?": { widget: 'calendar' },
    "What's on my calendar tomorrow?": { widget: 'calendar' },
    'When is my next meeting and what should I prepare?': { widget: 'calendar' },
    'What tasks do I have left today?': { widget: 'tasks' },
    "What's the status of my smart home devices?": { widget: 'home' },
    "What's the detailed weather forecast for today?": { widget: 'weather' },
  };

  const navTarget = navigateMap[action.action];
  if (navTarget) {
    return {
      id: action.id,
      label: action.label,
      icon: action.icon,
      type: 'navigate',
      navigateTo: navTarget,
    };
  }

  // Default: keep as chat action
  return {
    id: action.id,
    label: action.label,
    icon: action.icon,
    type: 'chat',
    chatMessage: action.action,
  };
}

/**
 * Generate default quick actions based on time of day
 */
export function getDefaultQuickActions(timeOfDay: TimeOfDay): QuickAction[] {
  const actions: QuickAction[] = [];

  if (timeOfDay === 'morning' || timeOfDay === 'afternoon') {
    actions.push({
      id: 'qa-calendar',
      label: 'View Calendar',
      icon: 'calendar',
      type: 'navigate',
      navigateTo: { widget: 'calendar' },
    });
    actions.push({
      id: 'qa-tasks',
      label: 'View Tasks',
      icon: 'task',
      type: 'navigate',
      navigateTo: { widget: 'tasks' },
    });
  }

  if (timeOfDay === 'evening') {
    actions.push({
      id: 'qa-summary',
      label: 'Day Summary',
      icon: 'chat',
      type: 'chat',
      chatMessage: 'Give me a summary of today',
    });
    actions.push({
      id: 'qa-tomorrow',
      label: "Tomorrow's Calendar",
      icon: 'calendar',
      type: 'navigate',
      navigateTo: { widget: 'calendar' },
    });
  }

  if (timeOfDay === 'night') {
    actions.push({
      id: 'qa-goodnight',
      label: 'Goodnight Routine',
      icon: 'home',
      type: 'chat',
      chatMessage: 'Run my goodnight routine',
    });
  }

  // Always include smart home
  actions.push({
    id: 'qa-home',
    label: 'Smart Home',
    icon: 'home',
    type: 'navigate',
    navigateTo: { widget: 'home' },
  });

  return actions.slice(0, 6);
}

/**
 * Hook to handle quick action execution with routing by type
 */
export function useQuickActions(): UseQuickActionsReturn {
  const sendToChat = useSendToChat();
  const { pushUpdate } = useOptionalWidgetUpdates();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const executeAction = useCallback(
    (action: QuickAction | LegacyQuickAction) => {
      // Normalize legacy actions
      const normalized = isLegacyQuickAction(action)
        ? normalizeLegacyAction(action)
        : action;

      // Visual feedback
      setActiveActionId(normalized.id);
      setTimeout(() => setActiveActionId(null), BRIEF_CONFIG.ACTION_FEEDBACK_MS);

      switch (normalized.type) {
        case 'chat':
          if (normalized.chatMessage) {
            sendToChat(normalized.chatMessage);
          }
          break;

        case 'navigate':
          if (normalized.navigateTo) {
            // Use WidgetUpdateContext to trigger the target widget to open/expand
            pushUpdate({
              widgetId: normalized.navigateTo.widget,
              action: 'navigate',
              data: normalized.navigateTo.view
                ? { view: normalized.navigateTo.view }
                : undefined,
            });
          }
          break;

        case 'widget-action':
          if (normalized.widgetAction) {
            pushUpdate({
              widgetId: normalized.widgetAction.widgetId,
              action: normalized.widgetAction.action,
              data: normalized.widgetAction.data,
            });
          }
          break;
      }
    },
    [sendToChat, pushUpdate]
  );

  return useMemo(
    () => ({ executeAction, activeActionId }),
    [executeAction, activeActionId]
  );
}

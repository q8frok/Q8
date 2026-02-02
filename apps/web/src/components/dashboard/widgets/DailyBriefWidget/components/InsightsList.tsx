'use client';

import { useCallback } from 'react';
import { Lightbulb } from 'lucide-react';
import { useSendToChat } from '@/contexts/ChatContext';
import { CollapsibleSection } from './CollapsibleSection';
import { InsightCard } from './InsightCard';
import { BRIEF_CONFIG } from '../constants';
import type { Insight } from '../types';

interface InsightsListProps {
  insights: Insight[];
  isOpen: boolean;
  onToggle: () => void;
  activeActionId: string | null;
  onSetActiveAction: (id: string | null) => void;
  onDismiss: (id: string) => void;
}

export function InsightsList({
  insights,
  isOpen,
  onToggle,
  activeActionId,
  onSetActiveAction,
  onDismiss,
}: InsightsListProps) {
  const sendToChat = useSendToChat();

  const handleAction = useCallback(
    (insight: Insight) => {
      if (insight.action) {
        sendToChat(insight.action.message);
        onSetActiveAction(insight.id);
        setTimeout(() => onSetActiveAction(null), BRIEF_CONFIG.ACTION_FEEDBACK_MS);
      }
    },
    [sendToChat, onSetActiveAction]
  );

  const handleDismiss = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss(id);
    },
    [onDismiss]
  );

  if (insights.length === 0) return null;

  return (
    <CollapsibleSection
      icon={<Lightbulb className="w-4 h-4 text-cyan-400" />}
      title="Insights"
      badge={`${insights.length}`}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        {insights.slice(0, BRIEF_CONFIG.MAX_INSIGHTS).map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            isActive={activeActionId === insight.id}
            onAction={handleAction}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}

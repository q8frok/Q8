'use client';

import { Zap, Send, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QUICK_ACTION_ICONS } from '../constants';
import { CollapsibleSection } from './CollapsibleSection';
import type { QuickAction, LegacyQuickAction } from '../types';
import { isLegacyQuickAction } from '../types';

interface QuickActionsBarProps {
  actions: (QuickAction | LegacyQuickAction)[];
  onAction: (action: QuickAction | LegacyQuickAction) => void;
  activeActionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

export function QuickActionsBar({
  actions,
  onAction,
  activeActionId,
  isOpen,
  onToggle,
}: QuickActionsBarProps) {
  if (!actions || actions.length === 0) return null;

  return (
    <CollapsibleSection
      icon={<Zap className="w-4 h-4 text-yellow-400" />}
      title="Quick Actions"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = QUICK_ACTION_ICONS[action.icon] || Zap;
          const isActive = activeActionId === action.id;
          const isNavigation = !isLegacyQuickAction(action) && action.type === 'navigate';

          return (
            <button
              key={action.id}
              onClick={() => onAction(action)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                'bg-white/5 hover:bg-neon-primary/20 border border-white/10 hover:border-neon-primary/30',
                isActive && 'bg-neon-primary/30 border-neon-primary/50',
                isNavigation && 'hover:bg-blue-500/20 hover:border-blue-500/30'
              )}
            >
              {isActive ? (
                <Send className="w-3 h-3 text-neon-primary" />
              ) : isNavigation ? (
                <ExternalLink className="w-3 h-3 text-blue-400" />
              ) : (
                <Icon className="w-3 h-3 text-white/60" />
              )}
              <span className="text-white/80">{action.label}</span>
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

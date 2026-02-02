'use client';

import { motion } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INSIGHT_ICONS, INSIGHT_PRIORITY_STYLES, PRIORITY_INDICATORS, INSIGHT_VARIANTS } from '../constants';
import type { Insight } from '../types';

interface InsightCardProps {
  insight: Insight;
  isActive: boolean;
  onAction: (insight: Insight) => void;
  onDismiss: (id: string, e: React.MouseEvent) => void;
}

export function InsightCard({ insight, isActive, onAction, onDismiss }: InsightCardProps) {
  const Icon = INSIGHT_ICONS[insight.type];

  return (
    <motion.div
      initial={INSIGHT_VARIANTS.initial}
      animate={INSIGHT_VARIANTS.animate}
      exit={INSIGHT_VARIANTS.exit}
      className={cn(
        'flex items-start gap-2 p-2 rounded-lg border cursor-pointer group',
        'hover:bg-white/5 transition-colors',
        INSIGHT_PRIORITY_STYLES[insight.priority],
        isActive && 'ring-1 ring-neon-primary/50'
      )}
      onClick={() => onAction(insight)}
    >
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-xs">{PRIORITY_INDICATORS[insight.priority]}</span>
        <Icon className="w-4 h-4 flex-shrink-0" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-medium text-white/90 truncate">
            {insight.title}
          </h4>
          {insight.dismissible && (
            <button
              onClick={(e) => onDismiss(insight.id, e)}
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
}

'use client';

import { RefreshCw, X, ChevronDown, ChevronUp, Sparkles, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GREETING_ICONS } from '../constants';
import type { BriefHeaderProps } from '../types';

export function BriefHeader({
  greeting,
  date,
  timeOfDay,
  isRefreshing,
  needsRegeneration,
  onRefresh,
  onRegenerate,
  onDismiss,
  onToggleExpand,
  onOpenFullScreen,
  isExpanded,
}: BriefHeaderProps & { onOpenFullScreen?: () => void }) {
  const GreetingIcon = GREETING_ICONS[timeOfDay];

  return (
    <div
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
      onClick={onToggleExpand}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <GreetingIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{greeting || 'Daily Brief'}</h3>
          <p className="text-xs text-white/60">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {needsRegeneration && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            className="px-2 py-1 text-xs bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary rounded-lg transition-colors flex items-center gap-1"
            aria-label="Regenerate brief with new features"
          >
            <Sparkles className="w-3 h-3" />
            Update
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            needsRegeneration ? onRegenerate() : onRefresh();
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label={needsRegeneration ? 'Regenerate brief' : 'Refresh brief'}
        >
          <RefreshCw
            className={cn(
              'w-4 h-4 text-white/40',
              isRefreshing && 'animate-spin'
            )}
          />
        </button>
        {onOpenFullScreen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullScreen();
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Open full screen"
          >
            <Maximize2 className="w-4 h-4 text-white/40" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss brief"
        >
          <X className="w-4 h-4 text-white/40" />
        </button>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-white/60" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/60" />
        )}
      </div>
    </div>
  );
}

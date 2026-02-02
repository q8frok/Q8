'use client';

import { cn } from '@/lib/utils';
import { GREETING_ICONS } from '../constants';
import type { TimeOfDay } from '../types';

interface EmptyStateProps {
  timeOfDay: TimeOfDay;
  isLoading: boolean;
  onGenerate: () => void;
  className?: string;
}

export function EmptyState({ timeOfDay, isLoading, onGenerate, className }: EmptyStateProps) {
  const GreetingIcon = GREETING_ICONS[timeOfDay];

  return (
    <div className={cn('surface-matte p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <GreetingIcon className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Daily Brief</h3>
            <p className="text-xs text-white/60">No brief generated yet today</p>
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className={cn(
            'px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition-colors',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading ? 'Generating...' : 'Generate Now'}
        </button>
      </div>
    </div>
  );
}

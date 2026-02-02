'use client';

import { motion } from 'framer-motion';
import { Coffee, Zap, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCurrentMode,
  useDashboardActions,
  type DashboardMode,
} from '@/lib/stores/dashboard';

const modes = [
  { id: 'relax' as const, label: 'Relax', icon: Coffee },
  { id: 'productivity' as const, label: 'Focus', icon: Zap },
  { id: 'all' as const, label: 'All', icon: LayoutGrid },
];

export function ModeSelector() {
  const currentMode = useCurrentMode();
  const { setMode } = useDashboardActions();

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-3/50 backdrop-blur-sm border border-border-subtle">
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        const Icon = mode.icon;

        return (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-primary/50',
              isActive ? 'text-white' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 rounded-lg bg-neon-primary/20 border border-neon-primary/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative hidden sm:inline text-xs font-medium">
              {mode.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

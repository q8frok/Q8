'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, LayoutGrid, Clock, Briefcase, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStore, type DashboardMode } from '@/lib/stores/dashboard';
import type { StepProps } from '../OnboardingWizard';

interface LayoutPreset {
  id: DashboardMode;
  name: string;
  description: string;
  icon: React.ElementType;
  widgets: string[];
}

const PRESETS: LayoutPreset[] = [
  {
    id: 'all',
    name: 'Everything',
    description: 'All widgets visible',
    icon: LayoutGrid,
    widgets: ['Daily Brief', 'Clock', 'Weather', 'Tasks', 'Calendar', 'Notes', 'Content', 'GitHub', 'Home', 'Finance'],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Focus on work essentials',
    icon: Briefcase,
    widgets: ['Tasks', 'Calendar', 'GitHub', 'Notes'],
  },
  {
    id: 'relax',
    name: 'Relaxed',
    description: 'Minimal, distraction-free',
    icon: Clock,
    widgets: ['Clock', 'Weather', 'Content'],
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Choose your own widgets',
    icon: Sparkles,
    widgets: [],
  },
];

export function GridCustomizeStep({ onNext: _onNext }: StepProps) {
  const { currentMode, setMode } = useDashboardStore();
  const [selected, setSelected] = useState<DashboardMode>(currentMode);

  const handleSelect = (mode: DashboardMode) => {
    setSelected(mode);
    // Only call setMode for non-custom modes (custom requires manual widget selection)
    if (mode !== 'custom') {
      setMode(mode);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-text-muted mb-6">
        Choose a dashboard layout that fits your workflow. You can always change this later.
      </p>

      <div className="grid gap-3">
        {PRESETS.map((preset, i) => (
          <motion.button
            key={preset.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleSelect(preset.id)}
            className={cn(
              'flex items-start gap-4 p-4 rounded-xl border text-left transition-all',
              selected === preset.id
                ? 'bg-neon-primary/10 border-neon-primary'
                : 'bg-surface-2 border-border-subtle hover:border-neon-primary/50'
            )}
          >
            <div
              className={cn(
                'h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0',
                selected === preset.id ? 'bg-neon-primary' : 'bg-surface-3'
              )}
            >
              <preset.icon
                className={cn(
                  'h-6 w-6',
                  selected === preset.id ? 'text-white' : 'text-text-muted'
                )}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{preset.name}</h3>
                {selected === preset.id && (
                  <Check className="h-5 w-5 text-neon-primary" />
                )}
              </div>
              <p className="text-sm text-text-muted mb-2">{preset.description}</p>
              {preset.widgets.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {preset.widgets.slice(0, 4).map(widget => (
                    <span
                      key={widget}
                      className="px-2 py-0.5 rounded-full text-xs bg-surface-3 text-text-muted"
                    >
                      {widget}
                    </span>
                  ))}
                  {preset.widgets.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-surface-3 text-text-muted">
                      +{preset.widgets.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

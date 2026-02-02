/**
 * Dashboard Store
 *
 * Zustand store for managing dashboard widget visibility and mode presets.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';

// ============================================================================
// TYPES
// ============================================================================

export type DashboardWidgetId =
  | 'daily-brief'
  | 'clock'
  | 'weather'
  | 'tasks'
  | 'calendar'
  | 'quick-notes'
  | 'content-hub'
  | 'github'
  | 'home'
  | 'finance';

export type DashboardMode = 'relax' | 'productivity' | 'all' | 'custom';

// ============================================================================
// MODE PRESETS
// ============================================================================

export const ALL_WIDGET_IDS: DashboardWidgetId[] = [
  'daily-brief',
  'clock',
  'weather',
  'tasks',
  'calendar',
  'quick-notes',
  'content-hub',
  'github',
  'home',
  'finance',
];

export const MODE_WIDGETS: Record<Exclude<DashboardMode, 'custom'>, DashboardWidgetId[]> = {
  relax: ['daily-brief', 'clock', 'weather', 'quick-notes', 'content-hub', 'home'],
  productivity: ['daily-brief', 'clock', 'weather', 'quick-notes', 'tasks', 'calendar', 'home', 'finance'],
  all: [...ALL_WIDGET_IDS],
};

export const WIDGET_META: Record<DashboardWidgetId, { label: string; icon: string }> = {
  'daily-brief': { label: 'Daily Brief', icon: 'Sparkles' },
  'clock': { label: 'Clock', icon: 'Clock' },
  'weather': { label: 'Weather', icon: 'CloudSun' },
  'tasks': { label: 'Tasks', icon: 'CheckSquare' },
  'calendar': { label: 'Calendar', icon: 'CalendarDays' },
  'quick-notes': { label: 'Quick Notes', icon: 'StickyNote' },
  'content-hub': { label: 'Content Hub', icon: 'Play' },
  'github': { label: 'GitHub', icon: 'Github' },
  'home': { label: 'Smart Home', icon: 'Home' },
  'finance': { label: 'Finance', icon: 'TrendingUp' },
};

// ============================================================================
// HELPERS
// ============================================================================

function detectMode(widgets: DashboardWidgetId[]): DashboardMode {
  const sorted = [...widgets].sort();
  for (const mode of ['relax', 'productivity', 'all'] as const) {
    const preset = [...MODE_WIDGETS[mode]].sort();
    if (
      sorted.length === preset.length &&
      sorted.every((id, i) => id === preset[i])
    ) {
      return mode;
    }
  }
  return 'custom';
}

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface DashboardState {
  currentMode: DashboardMode;
  visibleWidgets: DashboardWidgetId[];

  // Actions
  setMode: (mode: Exclude<DashboardMode, 'custom'>) => void;
  toggleWidget: (id: DashboardWidgetId) => void;
  reset: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      currentMode: 'all',
      visibleWidgets: [...ALL_WIDGET_IDS],

      setMode: (mode) =>
        set({
          currentMode: mode,
          visibleWidgets: [...MODE_WIDGETS[mode]],
        }),

      toggleWidget: (id) =>
        set((state) => {
          const isVisible = state.visibleWidgets.includes(id);
          const next = isVisible
            ? state.visibleWidgets.filter((w) => w !== id)
            : [...state.visibleWidgets, id];
          return {
            visibleWidgets: next,
            currentMode: detectMode(next),
          };
        }),

      reset: () =>
        set({
          currentMode: 'all',
          visibleWidgets: [...ALL_WIDGET_IDS],
        }),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({
        currentMode: state.currentMode,
        visibleWidgets: state.visibleWidgets,
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useCurrentMode = () => useDashboardStore((s) => s.currentMode);

export const useVisibleWidgets = () =>
  useDashboardStore(useShallow((s) => s.visibleWidgets));

export const useDashboardActions = () =>
  useDashboardStore(
    useShallow((s) => ({
      setMode: s.setMode,
      toggleWidget: s.toggleWidget,
      reset: s.reset,
    }))
  );

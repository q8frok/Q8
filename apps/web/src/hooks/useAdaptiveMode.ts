'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentMode, useDashboardActions } from '@/lib/stores/dashboard';

type SuggestableMode = 'relax' | 'productivity' | 'all';

interface AdaptiveModeSuggestion {
  suggestedMode: SuggestableMode;
  label: string;
  /** Dismiss suggestion for this time block */
  dismiss: () => void;
  /** Accept suggestion */
  accept: () => void;
}

/**
 * Time-based mode suggestion: morning brief (6-10am), focus (10am-6pm), relax (6pm+).
 * Shows once per time block, dismissable.
 */
export function useAdaptiveMode(): AdaptiveModeSuggestion | null {
  const currentMode = useCurrentMode();
  const { setMode } = useDashboardActions();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ mode: SuggestableMode; label: string } | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let suggestedMode: SuggestableMode;
    let label: string;
    let block: string;

    if (hour >= 6 && hour < 10) {
      suggestedMode = 'productivity';
      label = 'Good morning! Switch to Focus mode?';
      block = 'morning';
    } else if (hour >= 10 && hour < 18) {
      suggestedMode = 'productivity';
      label = 'Time to focus. Switch to Focus mode?';
      block = 'work';
    } else {
      suggestedMode = 'relax';
      label = 'Wind down. Switch to Relax mode?';
      block = 'evening';
    }

    // Only suggest if current mode differs and not already dismissed for this block
    if (currentMode !== suggestedMode && dismissed !== block) {
      setSuggestion({ mode: suggestedMode, label });
    } else {
      setSuggestion(null);
    }
  }, [currentMode, dismissed]);

  const dismiss = useCallback(() => {
    const hour = new Date().getHours();
    const block = hour >= 6 && hour < 10 ? 'morning' : hour >= 10 && hour < 18 ? 'work' : 'evening';
    setDismissed(block);
    setSuggestion(null);
  }, []);

  const accept = useCallback(() => {
    if (suggestion) {
      setMode(suggestion.mode);
      dismiss();
    }
  }, [suggestion, setMode, dismiss]);

  if (!suggestion) return null;

  return {
    suggestedMode: suggestion.mode,
    label: suggestion.label,
    dismiss,
    accept,
  };
}

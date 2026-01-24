'use client';

import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { QUICK_DURATIONS } from '../constants';
import type { TimeInputProps } from '../types';

/**
 * TimeInput - Date/time picker with optional presets
 *
 * Input component for selecting date and time values.
 */
export const TimeInput = memo(function TimeInput({
  value,
  onChange,
  label,
  showPresets = false,
  minTime,
  maxTime,
  disabled = false,
}: TimeInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (minutes: number) => {
      const date = new Date();
      date.setMinutes(date.getMinutes() + minutes);
      // Round to nearest 15 minutes
      date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
      onChange(date.toISOString().slice(0, 16));
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm text-text-secondary">{label}</label>
      )}
      <input
        type="datetime-local"
        value={value}
        onChange={handleChange}
        min={minTime}
        max={maxTime}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 rounded-lg',
          'bg-surface-3 border border-border-subtle',
          'text-sm text-text-primary',
          'focus:outline-none focus:ring-2 focus:ring-neon-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      />

      {showPresets && (
        <div className="flex flex-wrap gap-1">
          {QUICK_DURATIONS.slice(0, 4).map(({ label: presetLabel, minutes }) => (
            <Button
              key={minutes}
              variant="ghost"
              size="sm"
              onClick={() => handlePresetClick(minutes)}
              disabled={disabled}
              className="text-xs h-6 px-2"
            >
              +{presetLabel}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});

TimeInput.displayName = 'TimeInput';

export default TimeInput;

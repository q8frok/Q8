'use client';

import { useState, useCallback, useMemo } from 'react';
import type { CalendarEvent, CalendarEventInput, UseEventFormReturn } from '../types';
import { DEFAULT_REMINDERS } from '../constants';

/**
 * Default form values for a new event
 */
function getDefaultFormData(
  defaultDate?: Date,
  defaultCalendarId?: string
): CalendarEventInput {
  const now = defaultDate || new Date();
  const startTime = new Date(now);
  startTime.setMinutes(Math.ceil(startTime.getMinutes() / 15) * 15, 0, 0);

  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1);

  return {
    title: '',
    description: '',
    start_time: startTime.toISOString().slice(0, 16),
    end_time: endTime.toISOString().slice(0, 16),
    all_day: false,
    location: '',
    calendar_id: defaultCalendarId || '',
    reminders: DEFAULT_REMINDERS,
    attendees: [],
  };
}

/**
 * Convert CalendarEvent to CalendarEventInput for editing
 */
function eventToFormData(event: CalendarEvent): CalendarEventInput {
  return {
    title: event.title,
    description: event.description || '',
    start_time: event.start_time.slice(0, 16),
    end_time: event.end_time.slice(0, 16),
    all_day: event.all_day,
    location: event.location || '',
    calendar_id: event.google_calendar_id,
    reminders: event.reminders || DEFAULT_REMINDERS,
    attendees: event.attendees?.map((a) => a.email) || [],
  };
}

/**
 * Validation rules
 */
function validateForm(formData: CalendarEventInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.title.trim()) {
    errors.title = 'Title is required';
  }

  if (!formData.start_time) {
    errors.start_time = 'Start time is required';
  }

  if (!formData.end_time) {
    errors.end_time = 'End time is required';
  }

  if (formData.start_time && formData.end_time) {
    const start = new Date(formData.start_time);
    const end = new Date(formData.end_time);
    if (end <= start && !formData.all_day) {
      errors.end_time = 'End time must be after start time';
    }
  }

  if (!formData.calendar_id) {
    errors.calendar_id = 'Please select a calendar';
  }

  return errors;
}

interface UseEventFormOptions {
  initialEvent?: CalendarEvent | null;
  defaultDate?: Date;
  defaultCalendarId?: string;
  onSubmit?: (data: CalendarEventInput) => Promise<void>;
}

/**
 * useEventForm Hook
 *
 * Manages form state for creating and editing calendar events.
 */
export function useEventForm(options: UseEventFormOptions = {}): UseEventFormReturn {
  const { initialEvent, defaultDate, defaultCalendarId, onSubmit } = options;

  // Initialize form data from existing event or defaults
  const initialFormData = useMemo(
    () =>
      initialEvent
        ? eventToFormData(initialEvent)
        : getDefaultFormData(defaultDate, defaultCalendarId),
    [initialEvent, defaultDate, defaultCalendarId]
  );

  const [formData, setFormData] = useState<CalendarEventInput>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Check if form has been modified
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  /**
   * Set a single form field
   */
  const setField = useCallback(
    <K extends keyof CalendarEventInput>(
      field: K,
      value: CalendarEventInput[K]
    ) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };

        // Auto-adjust end time when start time changes
        if (field === 'start_time' && !touched.has('end_time')) {
          const startDate = new Date(value as string);
          const endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + 1);
          updated.end_time = endDate.toISOString().slice(0, 16);
        }

        // Handle all-day toggle
        if (field === 'all_day' && value === true) {
          // For all-day events, set times to start/end of day
          const start = new Date(updated.start_time);
          start.setHours(0, 0, 0, 0);
          updated.start_time = start.toISOString().slice(0, 10);

          const end = new Date(updated.end_time);
          end.setHours(23, 59, 59, 999);
          updated.end_time = end.toISOString().slice(0, 10);
        }

        return updated;
      });

      setTouched((prev) => new Set(prev).add(field));

      // Clear field error when value changes
      if (errors[field]) {
        setErrors((prev) => {
          const updated = { ...prev };
          delete updated[field];
          return updated;
        });
      }
    },
    [errors, touched]
  );

  /**
   * Validate the form
   */
  const validate = useCallback((): boolean => {
    const newErrors = validateForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validate, onSubmit]);

  /**
   * Reset form to initial state
   */
  const reset = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setTouched(new Set());
  }, [initialFormData]);

  return {
    formData,
    errors,
    isSubmitting,
    isDirty,
    setField,
    handleSubmit,
    reset,
    validate,
  };
}

/**
 * Quick add form with simplified fields
 */
export function useQuickAddForm(options: {
  defaultCalendarId?: string;
  onSubmit?: (data: CalendarEventInput) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter an event title');
      return;
    }

    if (!options.defaultCalendarId) {
      setError('Please select a calendar');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Parse natural language (simple version)
      const now = new Date();
      const startTime = new Date(now);
      startTime.setMinutes(Math.ceil(startTime.getMinutes() / 15) * 15, 0, 0);

      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      const eventData: CalendarEventInput = {
        title: title.trim(),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        calendar_id: options.defaultCalendarId,
        all_day: false,
      };

      if (options.onSubmit) {
        await options.onSubmit(eventData);
      }

      // Reset on success
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  }, [title, options]);

  const reset = useCallback(() => {
    setTitle('');
    setError(null);
  }, []);

  return {
    title,
    setTitle,
    isSubmitting,
    error,
    handleSubmit,
    reset,
  };
}

export default useEventForm;

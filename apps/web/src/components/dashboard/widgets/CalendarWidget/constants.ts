/**
 * CalendarWidget Constants
 * Views, presets, colors, and configuration
 */

import type { CalendarView, CalendarTab, CompactView, EventReminder } from './types';

// ============================================================================
// View Configuration
// ============================================================================

export const CALENDAR_VIEWS: { id: CalendarView; label: string; icon: string }[] = [
  { id: 'month', label: 'Month', icon: 'CalendarDays' },
  { id: 'week', label: 'Week', icon: 'CalendarRange' },
  { id: 'day', label: 'Day', icon: 'CalendarClock' },
  { id: 'agenda', label: 'Agenda', icon: 'ListTodo' },
];

export const CALENDAR_TABS: { id: CalendarTab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Calendar', icon: 'Calendar' },
  { id: 'events', label: 'Events', icon: 'CalendarCheck' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

// Compact view options for widget display
export const COMPACT_VIEWS: { id: CompactView; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'next', label: 'Next Event' },
];

// ============================================================================
// Default Reminders
// ============================================================================

export const DEFAULT_REMINDERS: EventReminder[] = [
  { method: 'popup', minutes: 10 },
];

export const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '10 minutes before', minutes: 10 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
  { label: '2 days before', minutes: 2880 },
  { label: '1 week before', minutes: 10080 },
];

// ============================================================================
// Duration Presets
// ============================================================================

export const QUICK_DURATIONS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: 'All day', minutes: 1440 },
];

// ============================================================================
// Google Calendar Colors
// ============================================================================

export const GOOGLE_CALENDAR_COLORS: { id: string; hex: string; name: string }[] = [
  { id: '1', hex: '#7986cb', name: 'Lavender' },
  { id: '2', hex: '#33b679', name: 'Sage' },
  { id: '3', hex: '#8e24aa', name: 'Grape' },
  { id: '4', hex: '#e67c73', name: 'Flamingo' },
  { id: '5', hex: '#f6bf26', name: 'Banana' },
  { id: '6', hex: '#f4511e', name: 'Tangerine' },
  { id: '7', hex: '#039be5', name: 'Peacock' },
  { id: '8', hex: '#616161', name: 'Graphite' },
  { id: '9', hex: '#3f51b5', name: 'Blueberry' },
  { id: '10', hex: '#0b8043', name: 'Basil' },
  { id: '11', hex: '#d50000', name: 'Tomato' },
];

export const DEFAULT_EVENT_COLOR = '#039be5'; // Peacock

// ============================================================================
// Time Slots
// ============================================================================

export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

export const HOUR_SLOTS: number[] = Array.from({ length: 24 }, (_, i) => i);

// ============================================================================
// Day Names
// ============================================================================

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const DAY_NAMES_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ============================================================================
// Month Names
// ============================================================================

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ============================================================================
// Recurrence Options
// ============================================================================

export const RECURRENCE_OPTIONS: { id: string; label: string }[] = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'weekdays', label: 'Every weekday (Mon-Fri)' },
  { id: 'custom', label: 'Custom...' },
];

// ============================================================================
// Animation Variants
// ============================================================================

export const VIEW_TRANSITION_VARIANTS = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const MODAL_VARIANTS = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const SLIDE_VARIANTS = {
  initial: { opacity: 0, x: '100%' },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: '100%' },
};

// ============================================================================
// Grid Span Classes
// ============================================================================

export const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-3',
  4: 'col-span-1 md:col-span-4',
};

export const ROW_SPAN_CLASSES: Record<number, string> = {
  1: 'row-span-1',
  2: 'row-span-2',
  3: 'row-span-3',
  4: 'row-span-4',
};

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get a YYYY-MM-DD string in local timezone.
 * IMPORTANT: Do NOT use `date.toISOString().slice(0, 10)` — that returns UTC
 * which can be off by a day depending on timezone offset.
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert an ISO datetime string (e.g. from event.start_time) to a local YYYY-MM-DD string.
 * Use this instead of `isoString.slice(0, 10)` which returns the UTC date.
 */
export function isoToLocalDateStr(isoString: string): string {
  return toLocalDateStr(new Date(isoString));
}

// ============================================================================
// Sync Configuration
// ============================================================================

export const SYNC_CONFIG = {
  /** How far back to sync events (days) */
  SYNC_PAST_DAYS: 30,
  /** How far forward to sync events (days) */
  SYNC_FUTURE_DAYS: 365,
  /** Maximum events per sync request */
  MAX_EVENTS_PER_REQUEST: 250,
  /** Auto-sync interval (ms) - 5 minutes */
  AUTO_SYNC_INTERVAL: 5 * 60 * 1000,
  /** Stale threshold (ms) - 10 minutes */
  STALE_THRESHOLD: 10 * 60 * 1000,
};

// ============================================================================
// View Configuration
// ============================================================================

export const VIEW_CONFIG = {
  /** Hours to show in day/week view */
  DAY_START_HOUR: 0,
  DAY_END_HOUR: 24,
  /** Default working hours highlight */
  WORKING_HOURS_START: 9,
  WORKING_HOURS_END: 17,
  /** Pixels per hour in timeline views */
  HOUR_HEIGHT: 60,
  /** Minimum event height in pixels */
  MIN_EVENT_HEIGHT: 20,
  /** Days to show in agenda view initially */
  AGENDA_INITIAL_DAYS: 14,
  /** Days to load per "load more" in agenda */
  AGENDA_LOAD_MORE_DAYS: 7,
};

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  NEW_EVENT: 'c',
  TODAY: 't',
  MONTH_VIEW: 'm',
  WEEK_VIEW: 'w',
  DAY_VIEW: 'd',
  AGENDA_VIEW: 'a',
  NEXT_PERIOD: 'ArrowRight',
  PREV_PERIOD: 'ArrowLeft',
  CLOSE: 'Escape',
  SAVE: 'mod+s',
  DELETE: 'Delete',
};

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  FETCH_CALENDARS: 'Failed to fetch calendars. Please try again.',
  SYNC_EVENTS: 'Failed to sync events. Please try again.',
  CREATE_EVENT: 'Failed to create event. Please try again.',
  UPDATE_EVENT: 'Failed to update event. Please try again.',
  DELETE_EVENT: 'Failed to delete event. Please try again.',
  AUTH_REQUIRED: 'Please link your Google Calendar to continue.',
  CALENDAR_ACCESS_DENIED: 'Calendar access was denied. Please re-link your account.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
};

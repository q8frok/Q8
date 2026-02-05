/**
 * CalendarWidget Hooks - Barrel Export
 */

export { useCalendarSync, default as useCalendarSyncDefault } from './useCalendarSync';
export {
  useCalendarEvents,
  useEventsForDate,
  useEventsForRange,
  useNextEvent,
  useTodayEvents,
  default as useCalendarEventsDefault,
} from './useCalendarEvents';
export {
  useEventForm,
  useQuickAddForm,
  default as useEventFormDefault,
} from './useEventForm';
export {
  useCalendarNavigation,
  default as useCalendarNavigationDefault,
} from './useCalendarNavigation';
export type { UseCalendarNavigationReturn } from './useCalendarNavigation';
export {
  useCalendarActions,
  default as useCalendarActionsDefault,
} from './useCalendarActions';
export type { UseCalendarActionsReturn } from './useCalendarActions';

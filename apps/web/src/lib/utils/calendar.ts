/**
 * Calendar Utilities
 * Date formatting, event parsing, and calendar helpers
 */

import { format, parseISO, isToday, isTomorrow, isThisWeek, addDays, startOfDay, endOfDay } from 'date-fns';

export interface ParsedEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  meetingUrl?: string;
  attendees?: string[];
}

export function parseGoogleCalendarEvent(event: any): ParsedEvent {
  const start = event.start?.dateTime 
    ? parseISO(event.start.dateTime)
    : parseISO(event.start?.date || new Date().toISOString());
  
  const end = event.end?.dateTime
    ? parseISO(event.end.dateTime)
    : parseISO(event.end?.date || new Date().toISOString());

  const isAllDay = !event.start?.dateTime;

  const meetingUrl = extractMeetingUrl(event.description || event.hangoutLink);

  return {
    id: event.id,
    title: event.summary || 'Untitled Event',
    description: event.description,
    start,
    end,
    isAllDay,
    location: event.location,
    meetingUrl,
    attendees: event.attendees?.map((a: any) => a.email) || [],
  };
}

export function extractMeetingUrl(text?: string): string | undefined {
  if (!text) return undefined;

  const patterns = [
    /https?:\/\/meet\.google\.com\/[a-z-]+/i,
    /https?:\/\/zoom\.us\/j\/\d+/i,
    /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s]+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return undefined;
}

export function getEventTimeDisplay(event: ParsedEvent): string {
  if (event.isAllDay) {
    return 'All day';
  }

  const startTime = format(event.start, 'h:mm a');
  const endTime = format(event.end, 'h:mm a');

  return `${startTime} - ${endTime}`;
}

export function getEventDateDisplay(event: ParsedEvent): string {
  const start = event.start;

  if (isToday(start)) {
    return 'Today';
  }

  if (isTomorrow(start)) {
    return 'Tomorrow';
  }

  if (isThisWeek(start)) {
    return format(start, 'EEEE');
  }

  return format(start, 'MMM d');
}

export function getEventDuration(event: ParsedEvent): number {
  return Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60));
}

export function isEventHappening(event: ParsedEvent): boolean {
  const now = new Date();
  return now >= event.start && now <= event.end;
}

export function isEventUpcoming(event: ParsedEvent, withinMinutes: number = 15): boolean {
  const now = new Date();
  const minutesUntil = (event.start.getTime() - now.getTime()) / (1000 * 60);
  return minutesUntil > 0 && minutesUntil <= withinMinutes;
}

export function getEventsForDate(events: ParsedEvent[], date: Date): ParsedEvent[] {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  return events.filter(event => {
    return (
      (event.start >= dayStart && event.start <= dayEnd) ||
      (event.end >= dayStart && event.end <= dayEnd) ||
      (event.start <= dayStart && event.end >= dayEnd)
    );
  });
}

export function getEventsForWeek(events: ParsedEvent[], startDate: Date): ParsedEvent[] {
  const weekEnd = addDays(startDate, 7);

  return events.filter(event => {
    return event.start >= startDate && event.start < weekEnd;
  });
}

export function sortEventsByStart(events: ParsedEvent[]): ParsedEvent[] {
  return [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function getNextEvent(events: ParsedEvent[]): ParsedEvent | null {
  const now = new Date();
  const upcomingEvents = events
    .filter(event => event.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return upcomingEvents[0] || null;
}

export function getCurrentEvent(events: ParsedEvent[]): ParsedEvent | null {
  return events.find(isEventHappening) || null;
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function getEventColor(calendarId: string): string {
  const colors: Record<string, string> = {
    primary: '#8B5CF6',
    work: '#3B82F6',
    personal: '#10B981',
    family: '#F59E0B',
    default: '#6B7280',
  };

  return colors[calendarId] || '#6B7280';
}

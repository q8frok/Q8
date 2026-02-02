'use client';

import { Calendar } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { BRIEF_CONFIG } from '../constants';
import type { CalendarEvent } from '../types';

interface CalendarPreviewProps {
  events: CalendarEvent[];
  isOpen: boolean;
  onToggle: () => void;
}

export function CalendarPreview({ events, isOpen, onToggle }: CalendarPreviewProps) {
  if (!events || events.length === 0) return null;

  return (
    <CollapsibleSection
      icon={<Calendar className="w-4 h-4 text-blue-400" />}
      title="Calendar"
      badge={`${events.length} event${events.length !== 1 ? 's' : ''}`}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        {events.slice(0, BRIEF_CONFIG.MAX_CALENDAR_EVENTS).map((event, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="text-white/50 font-mono text-xs w-16 shrink-0">
              {event.time}
            </span>
            <div>
              <p className="text-white/90">{event.title}</p>
              {event.location && (
                <p className="text-white/50 text-xs">{event.location}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

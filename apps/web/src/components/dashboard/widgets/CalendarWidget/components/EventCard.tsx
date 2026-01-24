'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  MapPin,
  Video,
  Users,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventCardProps } from '../types';

/**
 * EventCard - Displays a single calendar event
 *
 * Reusable card component showing event details with optional actions.
 */
export const EventCard = memo(function EventCard({
  event,
  isCompact = false,
  showDate = false,
  showCalendar = false,
  onClick,
  onJoinMeeting,
}: EventCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(event);
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoinMeeting && event.meeting_url) {
      onJoinMeeting(event.meeting_url);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'card-item relative overflow-hidden cursor-pointer transition-all',
        'hover:bg-surface-4/80',
        event.isNow && 'ring-1 ring-success',
        isCompact && 'py-2'
      )}
      onClick={handleClick}
    >
      {/* Color Indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
        style={{ backgroundColor: event.calendarColor }}
      />

      <div className="pl-2">
        {/* Time & Status */}
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-3 w-3 text-text-muted" />
          <span className="text-caption">
            {showDate && `${event.formattedDate}, `}
            {event.formattedTime}
          </span>
          {event.isNow && (
            <span className="badge badge-success text-[10px]">Now</span>
          )}
          {showCalendar && (
            <span className="text-caption text-text-muted ml-auto truncate max-w-[100px]">
              {event.calendar_name}
            </span>
          )}
        </div>

        {/* Title */}
        <h4
          className={cn(
            'text-body font-medium line-clamp-2',
            isCompact ? 'text-xs mb-1' : 'text-sm mb-2'
          )}
        >
          {event.title}
        </h4>

        {/* Metadata - only show if not compact */}
        {!isCompact && (
          <div className="flex flex-wrap gap-3 text-caption">
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{event.location}</span>
              </div>
            )}

            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{event.attendees.length}</span>
              </div>
            )}

            {event.meeting_url && (
              <button
                type="button"
                onClick={handleJoinClick}
                className="flex items-center gap-1 text-neon-primary hover:text-neon-accent transition-colors focus-ring rounded"
              >
                <Video className="h-3 w-3" />
                <span>Join</span>
                <ExternalLink className="h-2 w-2" />
              </button>
            )}
          </div>
        )}

        {/* Compact meeting button */}
        {isCompact && event.meeting_url && (
          <button
            type="button"
            onClick={handleJoinClick}
            className="flex items-center gap-1 text-xs text-neon-primary hover:text-neon-accent transition-colors focus-ring rounded"
          >
            <Video className="h-3 w-3" />
            <span>Join</span>
          </button>
        )}
      </div>
    </motion.div>
  );
});

EventCard.displayName = 'EventCard';

export default EventCard;

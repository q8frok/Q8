'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  MapPin,
  Video,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { NextEventCardProps } from '../types';

/**
 * Format time until event
 */
function formatTimeUntil(startDate: Date): string {
  const now = new Date();
  const diff = startDate.getTime() - now.getTime();

  if (diff < 0) {
    return 'Now';
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `in ${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `in ${minutes}m`;
  }
  return 'Now';
}

/**
 * NextEventCard - Highlighted next upcoming event
 *
 * Prominent display of the next event with countdown and quick actions.
 */
export const NextEventCard = memo(function NextEventCard({
  event,
  onEventClick,
  onJoinMeeting,
}: NextEventCardProps) {
  const timeUntil = useMemo(() => {
    if (!event) return '';
    return formatTimeUntil(event.startDate);
  }, [event]);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar className="h-10 w-10 text-text-muted mb-3" />
        <p className="text-sm text-text-secondary">No upcoming events</p>
        <p className="text-xs text-text-muted mt-1">
          Your schedule is clear
        </p>
      </div>
    );
  }

  const handleClick = () => {
    if (onEventClick) {
      onEventClick(event);
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative p-4 rounded-xl overflow-hidden cursor-pointer',
        'bg-gradient-to-br from-surface-4/80 to-surface-3/50',
        'border border-border-subtle',
        'hover:border-neon-primary/30 transition-all',
        event.isNow && 'ring-2 ring-success/50'
      )}
      onClick={handleClick}
    >
      {/* Color accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: event.calendarColor }}
      />

      {/* Time Until */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neon-primary" />
          <span
            className={cn(
              'text-sm font-semibold',
              event.isNow ? 'text-success' : 'text-neon-primary'
            )}
          >
            {timeUntil}
          </span>
        </div>
        <span className="text-xs text-text-muted">
          {event.formattedDate}
        </span>
      </div>

      {/* Event Title */}
      <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2">
        {event.title}
      </h3>

      {/* Time */}
      <p className="text-sm text-text-secondary mb-3">
        {event.formattedTime}
        {event.durationMinutes > 0 && !event.all_day && (
          <span className="text-text-muted ml-2">
            ({Math.floor(event.durationMinutes / 60)}h{' '}
            {event.durationMinutes % 60}m)
          </span>
        )}
      </p>

      {/* Location */}
      {event.location && (
        <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{event.location}</span>
        </div>
      )}

      {/* Actions */}
      {event.meeting_url && (
        <Button
          variant="default"
          size="sm"
          onClick={handleJoinClick}
          className="w-full bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary"
        >
          <Video className="h-4 w-4 mr-2" />
          Join Meeting
          <ExternalLink className="h-3 w-3 ml-2" />
        </Button>
      )}
    </motion.div>
  );
});

NextEventCard.displayName = 'NextEventCard';

export default NextEventCard;

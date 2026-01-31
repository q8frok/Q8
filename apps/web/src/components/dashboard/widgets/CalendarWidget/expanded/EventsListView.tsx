'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  ArrowUpDown,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventCard } from '../components/EventCard';
import type { CalendarEventDisplay } from '../types';

type SortMode = 'chronological' | 'reverse-chrono' | 'date-created' | 'creator' | 'alphabetical' | 'duration';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'chronological', label: 'Date (earliest first)' },
  { id: 'reverse-chrono', label: 'Date (latest first)' },
  { id: 'date-created', label: 'Date created' },
  { id: 'creator', label: 'Organizer' },
  { id: 'alphabetical', label: 'Title (A-Z)' },
  { id: 'duration', label: 'Duration (longest first)' },
];

interface EventsListViewProps {
  events: CalendarEventDisplay[];
  onEventClick: (event: CalendarEventDisplay) => void;
}

function getOrganizer(event: CalendarEventDisplay): string {
  const organizer = event.attendees?.find((a) => a.organizer);
  return organizer?.displayName || organizer?.email || '';
}

function sortEvents(events: CalendarEventDisplay[], mode: SortMode): CalendarEventDisplay[] {
  const sorted = [...events];
  switch (mode) {
    case 'chronological':
      return sorted.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    case 'reverse-chrono':
      return sorted.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    case 'date-created':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'creator':
      return sorted.sort((a, b) => getOrganizer(a).localeCompare(getOrganizer(b)));
    case 'alphabetical':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'duration':
      return sorted.sort((a, b) => b.durationMinutes - a.durationMinutes);
    default:
      return sorted;
  }
}

/**
 * EventsListView - Full searchable/sortable event list for expanded view
 *
 * Provides access to ALL events with filtering and multiple sort modes.
 */
export const EventsListView = memo(function EventsListView({
  events,
  onEventClick,
}: EventsListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('chronological');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'upcoming' | 'past'>('all');

  const filteredAndSorted = useMemo(() => {
    let filtered = events;
    const now = new Date();

    // Filter by time
    switch (filterMode) {
      case 'upcoming':
        filtered = filtered.filter((e) => e.endDate >= now);
        break;
      case 'past':
        filtered = filtered.filter((e) => e.endDate < now);
        break;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description?.toLowerCase().includes(q)) ||
          (e.location?.toLowerCase().includes(q)) ||
          (e.calendar_name?.toLowerCase().includes(q)) ||
          e.attendees?.some(
            (a) =>
              a.email.toLowerCase().includes(q) ||
              (a.displayName?.toLowerCase().includes(q))
          )
      );
    }

    return sortEvents(filtered, sortMode);
  }, [events, searchQuery, sortMode, filterMode]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <Calendar className="h-16 w-16 text-text-muted mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-1">
          No events
        </h3>
        <p className="text-sm text-text-muted">
          No calendar events found.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Search and Controls Bar */}
      <div className="max-w-3xl mx-auto w-full mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by title, description, location, attendee..."
            className={cn(
              'w-full pl-10 pr-10 py-2.5 rounded-lg',
              'bg-surface-3 border border-border-subtle',
              'text-sm text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-neon-primary/50'
            )}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter and Sort Row */}
        <div className="flex items-center justify-between">
          {/* Time Filter Tabs */}
          <div className="flex items-center gap-1 bg-surface-3 rounded-lg p-0.5">
            {(['all', 'upcoming', 'past'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  filterMode === mode
                    ? 'bg-neon-primary/20 text-neon-primary'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center gap-2">
            <span className="text-xs text-text-muted">
              {filteredAndSorted.length} result{filteredAndSorted.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1 rounded hover:bg-surface-4"
            >
              <ArrowUpDown className="h-3 w-3" />
              Sort
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-surface-2 border border-border-subtle rounded-lg shadow-xl py-1 min-w-[200px]">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortMode(option.id);
                        setShowSortMenu(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs transition-colors',
                        sortMode === option.id
                          ? 'text-neon-primary bg-neon-primary/10'
                          : 'text-text-secondary hover:bg-surface-4'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-2">
          {filteredAndSorted.length === 0 ? (
            <div className="text-center py-8">
              <Filter className="h-8 w-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">
                No events match your search
              </p>
            </div>
          ) : (
            filteredAndSorted.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
              >
                <EventCard
                  event={event}
                  showDate
                  showCalendar
                  onClick={onEventClick}
                  onJoinMeeting={(url) => window.open(url, '_blank')}
                />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

EventsListView.displayName = 'EventsListView';

export default EventsListView;

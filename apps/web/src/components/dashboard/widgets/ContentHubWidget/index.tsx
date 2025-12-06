'use client';

import { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContentHubStore } from '@/lib/stores/contenthub';
import { useContentHub, useSpotifyControls } from '@/hooks/useContentHub';
import { NowPlayingCard } from './NowPlayingCard';
import { UpNextQueue } from './UpNextQueue';
import { QuickActions } from './QuickActions';
import type { ContentItem } from '@/types/contenthub';

interface ContentHubWidgetProps {
  className?: string;
}

/**
 * ContentHubWidget - Unified Media Hub
 *
 * Aggregates content from multiple sources (Spotify, YouTube, Netflix, etc.)
 * with a compact "card stack" view and expandable MediaCommandCenter overlay.
 *
 * Features:
 * - Now Playing with dynamic color theming
 * - Up Next queue with drag-and-drop
 * - Mode switching (Focus, Break, Workout, Sleep, Discover)
 * - Quick actions (AI Discover, Smart Home, Voice)
 */
export function ContentHubWidget({ className }: ContentHubWidgetProps) {
  const {
    nowPlaying,
    isPlaying,
    progress,
    queue,
    isExpanded,
    isLoading,
    error,
    play,
    removeFromQueue,
    toggleExpanded,
    setError,
  } = useContentHubStore();

  // Data fetching and API controls
  const { search } = useContentHub();
  const spotifyControls = useSpotifyControls();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);

  // Playback control handlers - use Spotify API when source is Spotify
  const handlePlayPause = useCallback(() => {
    if (nowPlaying?.source === 'spotify') {
      if (isPlaying) {
        spotifyControls.pause();
      } else {
        spotifyControls.play();
      }
    } else {
      // For other sources, just toggle local state
      useContentHubStore.setState({ isPlaying: !isPlaying });
    }
  }, [isPlaying, nowPlaying?.source, spotifyControls]);

  const handlePlay = useCallback(
    (item: ContentItem) => {
      play(item);
      // If it's a Spotify track, trigger actual playback
      if (item.source === 'spotify' && item.sourceMetadata?.uri) {
        spotifyControls.play(item.sourceMetadata.uri as string);
      }
    },
    [play, spotifyControls]
  );

  const handleSeek = useCallback(
    (position: number) => {
      useContentHubStore.setState({ progress: position });
      if (nowPlaying?.source === 'spotify') {
        spotifyControls.seek(position);
      }
    },
    [nowPlaying?.source, spotifyControls]
  );

  const handleNext = useCallback(() => {
    if (nowPlaying?.source === 'spotify') {
      spotifyControls.next();
    } else {
      useContentHubStore.getState().next();
    }
  }, [nowPlaying?.source, spotifyControls]);

  const handlePrevious = useCallback(() => {
    if (nowPlaying?.source === 'spotify') {
      spotifyControls.previous();
    } else {
      useContentHubStore.getState().previous();
    }
  }, [nowPlaying?.source, spotifyControls]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when not in input
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowRight':
          if (e.shiftKey) handleNext();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) handlePrevious();
          break;
        case 'Escape':
          if (isExpanded) toggleExpanded();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleNext, handlePrevious, isExpanded, toggleExpanded]);

  // Handle AI discover action - fetch recommendations based on mode
  const handleAIDiscover = useCallback(async () => {
    const mode = useContentHubStore.getState().activeMode;
    const results = await search(`${mode} music playlist`);
    if (results.length > 0) {
      results.forEach(item => useContentHubStore.getState().addToQueue(item));
    }
  }, [search]);

  // Handle Smart Home casting
  const handleSmartHome = useCallback(() => {
    // Open the external link in Spotify/YouTube app
    if (nowPlaying?.deepLinkUrl) {
      window.open(nowPlaying.deepLinkUrl, '_blank');
    }
  }, [nowPlaying?.deepLinkUrl]);

  // Handle Voice control
  const handleVoice = useCallback(() => {
    // Toggle voice mode (could emit event to parent)
    console.log('Voice control triggered');
  }, []);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = await search(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error, setError]);

  return (
    <>
      {/* Compact Widget View */}
      <motion.div
        layout
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'bg-glass-bg backdrop-blur-glass border border-glass-border',
          'shadow-glass transition-all duration-300',
          className
        )}
      >
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-xs px-3 py-1.5 flex items-center justify-between"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center"
            >
              <div className="h-8 w-8 border-2 border-neon-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-glass-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon-primary" />
            <span className="text-sm font-medium">ContentHub</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>

            {/* Expand toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleExpanded}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-glass-border"
            >
              <div className="p-2">
                <Input
                  placeholder="Search across all sources..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="h-8 text-sm bg-glass-bg border-glass-border"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Now Playing Card */}
        <NowPlayingCard
          item={nowPlaying}
          isPlaying={isPlaying}
          progress={progress}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSeek={handleSeek}
          onExpand={toggleExpanded}
          compact={false}
          className="min-h-[200px]"
        />

        {/* Quick Actions */}
        <div className="px-3 py-2 border-t border-glass-border">
          <QuickActions
            onAIDiscover={handleAIDiscover}
            onSmartHome={handleSmartHome}
            onVoice={handleVoice}
          />
        </div>

        {/* Up Next Queue */}
        <div className="px-3 border-t border-glass-border">
          <UpNextQueue
            items={queue}
            onPlay={handlePlay}
            onRemove={removeFromQueue}
            maxVisible={4}
          />
        </div>
      </motion.div>

      {/* Expanded MediaCommandCenter Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <MediaCommandCenter
            onClose={toggleExpanded}
            nowPlaying={nowPlaying}
            isPlaying={isPlaying}
            progress={progress}
            queue={queue}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSeek={handleSeek}
            onPlay={handlePlay}
            onRemove={removeFromQueue}
            onAIDiscover={handleAIDiscover}
            onSmartHome={handleSmartHome}
            onVoice={handleVoice}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * MediaCommandCenter - Expanded fullscreen overlay
 */
interface MediaCommandCenterProps {
  onClose: () => void;
  nowPlaying: ContentItem | null;
  isPlaying: boolean;
  progress: number;
  queue: ContentItem[];
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (position: number) => void;
  onPlay: (item: ContentItem) => void;
  onRemove: (itemId: string) => void;
  onAIDiscover: () => void;
  onSmartHome: () => void;
  onVoice: () => void;
}

function MediaCommandCenter({
  onClose,
  nowPlaying,
  isPlaying,
  progress,
  queue,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onPlay,
  onRemove,
  onAIDiscover,
  onSmartHome,
  onVoice,
}: MediaCommandCenterProps) {
  const { history, savedForLater, activeMode } = useContentHubStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl"
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <Minimize2 className="h-5 w-5" />
      </Button>

      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-neon-primary" />
              <h1 className="text-2xl font-bold text-white">MediaCommandCenter</h1>
            </div>

            {/* Quick Actions */}
            <QuickActions
              onAIDiscover={onAIDiscover}
              onSmartHome={onSmartHome}
              onVoice={onVoice}
              className="flex-row-reverse"
            />
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Now Playing - Large */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl overflow-hidden bg-glass-bg/50 backdrop-blur-sm border border-glass-border">
                <NowPlayingCard
                  item={nowPlaying}
                  isPlaying={isPlaying}
                  progress={progress}
                  onPlayPause={onPlayPause}
                  onNext={onNext}
                  onPrevious={onPrevious}
                  onSeek={onSeek}
                  showControls={true}
                  compact={false}
                  className="min-h-[300px]"
                />
              </div>
            </div>

            {/* Queue & History sidebar */}
            <div className="space-y-6">
              {/* Up Next */}
              <div className="rounded-2xl bg-glass-bg/50 backdrop-blur-sm border border-glass-border p-4">
                <h3 className="text-sm font-medium text-white mb-3">Up Next</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {queue.slice(0, 5).map((item, index) => (
                    <QueueItem
                      key={item.id}
                      item={item}
                      index={index}
                      onPlay={() => onPlay(item)}
                      onRemove={() => onRemove(item.id)}
                    />
                  ))}
                  {queue.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Queue is empty
                    </p>
                  )}
                </div>
              </div>

              {/* Recently Played */}
              <div className="rounded-2xl bg-glass-bg/50 backdrop-blur-sm border border-glass-border p-4">
                <h3 className="text-sm font-medium text-white mb-3">Recently Played</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {history.slice(0, 5).map((item, index) => (
                    <QueueItem
                      key={`${item.id}-${index}`}
                      item={item}
                      index={index}
                      onPlay={() => onPlay(item)}
                      showRemove={false}
                    />
                  ))}
                  {history.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No history yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Saved for Later */}
          {savedForLater.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-white mb-4">Saved for Later</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {savedForLater.slice(0, 12).map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onClick={() => onPlay(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Browse by Source - Placeholder for future content rows */}
          <div className="mt-8">
            <h3 className="text-lg font-medium text-white mb-4">
              Discover for {activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Mode
            </h3>
            <p className="text-sm text-muted-foreground">
              Content recommendations will appear here based on your active mode and preferences.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Queue item for sidebar lists
 */
function QueueItem({
  item,
  index,
  onPlay,
  onRemove,
  showRemove = true,
}: {
  item: ContentItem;
  index: number;
  onPlay: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer group"
      onClick={onPlay}
    >
      <span className="w-4 text-[10px] text-muted-foreground text-center">
        {index + 1}
      </span>
      <img
        src={item.thumbnailUrl}
        alt={item.title}
        className="h-8 w-8 rounded object-cover"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{item.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
      </div>
      {showRemove && onRemove && (
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

/**
 * Content card for grid display
 */
function ContentCard({
  item,
  onClick,
}: {
  item: ContentItem;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-glass-bg">
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="mt-1.5 text-xs font-medium text-white truncate">{item.title}</p>
      <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
    </motion.div>
  );
}

export default ContentHubWidget;

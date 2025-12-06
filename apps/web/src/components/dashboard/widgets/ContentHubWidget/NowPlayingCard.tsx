'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  ExternalLink,
  Maximize2,
  Cast,
  ListMusic,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useContentHubStore } from '@/lib/stores/contenthub';
import { useColorTheme } from '@/hooks/useColorTheme';
import type { ContentItem } from '@/types/contenthub';

interface NowPlayingCardProps {
  item: ContentItem | null;
  isPlaying: boolean;
  progress: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek?: (position: number) => void;
  onExpand?: () => void;
  showControls?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * NowPlayingCard Component
 *
 * Displays currently playing content with dynamic color theming,
 * playback controls, and progress tracking.
 */
export function NowPlayingCard({
  item,
  isPlaying,
  progress,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onExpand,
  showControls = true,
  compact = false,
  className,
}: NowPlayingCardProps) {
  const { volume, setVolume, toggleExpanded } = useContentHubStore();
  const { gradientStyle, dominantColor } = useColorTheme(item?.thumbnailUrl ?? null);

  // Calculate progress percentage
  const progressPercent = item?.duration
    ? (progress / item.duration) * 100
    : 0;

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!item?.duration || !onSeek) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newPosition = clickPosition * item.duration;
    onSeek(newPosition);
  };

  // Get source icon/label
  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      spotify: 'Spotify',
      youtube: 'YouTube',
      netflix: 'Netflix',
      instagram: 'Instagram',
      podcast: 'Podcast',
    };
    return labels[source] ?? source;
  };

  // Get external link
  const getExternalLink = () => {
    if (item?.playbackUrl) return item.playbackUrl;
    if (item?.deepLinkUrl) return item.deepLinkUrl;
    return null;
  };

  if (!item) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-6 text-center',
          className
        )}
      >
        <div>
          <ListMusic className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Nothing playing</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Search or browse to start
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('relative h-full', className)}
    >
      {/* Dynamic gradient background */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={gradientStyle}
      />

      {/* Blurred album art background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl scale-110"
        style={{ backgroundImage: `url(${item.thumbnailUrl})` }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col p-3">
        {/* Header with source badge */}
        <div className="flex items-center justify-between mb-2">
          <span
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded-full',
              'bg-white/10 text-white/80 backdrop-blur-sm'
            )}
          >
            {getSourceLabel(item.source)}
          </span>

          <div className="flex items-center gap-1">
            {/* Cast button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/70 hover:text-white"
            >
              <Cast className="h-3 w-3" />
            </Button>

            {/* Expand button */}
            {onExpand && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/70 hover:text-white"
                onClick={onExpand}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex items-start gap-3 flex-1 min-h-0">
          {/* Thumbnail */}
          <AnimatePresence mode="wait">
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative flex-shrink-0"
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className={cn(
                  'rounded-lg shadow-lg object-cover',
                  compact ? 'h-12 w-12' : 'h-16 w-16'
                )}
              />
              {/* Playing indicator */}
              {isPlaying && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-neon-primary rounded-full flex items-center justify-center">
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 bg-white rounded-full"
                        animate={{
                          height: ['4px', '8px', '4px'],
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.1,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-white truncate">
              {item.title}
            </h4>
            <p className="text-xs text-white/70 truncate">{item.subtitle}</p>

            {/* External link */}
            {getExternalLink() && (
              <a
                href={getExternalLink()!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-neon-primary hover:text-neon-accent mt-1"
              >
                Open in {getSourceLabel(item.source)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex-shrink-0">
          <div
            className="h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer group"
            onClick={handleProgressClick}
          >
            <motion.div
              className="h-full bg-neon-accent group-hover:bg-neon-primary transition-colors"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/60 mt-1">
            <span>{formatDuration(progress)}</span>
            <span>{formatDuration(item.duration)}</span>
          </div>
        </div>

        {/* Playback controls */}
        {showControls && (
          <div className="flex items-center justify-center gap-1 mt-2 flex-shrink-0">
            {/* Shuffle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:text-white"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </Button>

            {/* Previous */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:text-white"
              onClick={onPrevious}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            {/* Play/Pause */}
            <Button
              variant="neon"
              size="icon"
              className="h-10 w-10"
              onClick={onPlayPause}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>

            {/* Next */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:text-white"
              onClick={onNext}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Repeat */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/70 hover:text-white"
            >
              <Repeat className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Volume control */}
        {showControls && !compact && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/50 hover:text-white"
              onClick={() => setVolume(volume === 0 ? 80 : 0)}
            >
              {volume === 0 ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
            <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white/50"
                style={{ width: `${volume}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Helper: Format duration in mm:ss
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

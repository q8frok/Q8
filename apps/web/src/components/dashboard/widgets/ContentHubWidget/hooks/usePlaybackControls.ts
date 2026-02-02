/**
 * usePlaybackControls Hook
 * Encapsulates playback control logic for ContentHub
 * Supports Spotify (via API), YouTube (via iframe API), and queue-based sources.
 */

import { useCallback, useState } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';
import { useSpotifyControls } from '@/hooks/useContentHub';
import { logger } from '@/lib/logger';
import type { ContentItem } from '@/types/contenthub';

interface UsePlaybackControlsReturn {
  controlLoading: boolean;
  handlePlayPause: () => Promise<void>;
  handlePlay: (item: ContentItem) => void;
  handleSeek: (position: number) => void;
  handleNext: () => Promise<void>;
  handlePrevious: () => Promise<void>;
  handleShuffle: () => Promise<void>;
  handleRepeat: () => Promise<void>;
  handleVolumeChange: (volume: number) => Promise<void>;
  spotifyControls: ReturnType<typeof useSpotifyControls>;
}

export function usePlaybackControls(): UsePlaybackControlsReturn {
  const {
    nowPlaying,
    isPlaying,
    shuffleState,
    repeatState,
    youtubeControls,
    play,
  } = useContentHubStore();

  const spotifyControls = useSpotifyControls();
  const [controlLoading, setControlLoading] = useState(false);

  const handlePlayPause = useCallback(async () => {
    if (nowPlaying?.source === 'spotify') {
      setControlLoading(true);
      useContentHubStore.setState({ isPlaying: !isPlaying });
      try {
        if (isPlaying) {
          await spotifyControls.pause();
        } else {
          await spotifyControls.play();
        }
      } catch (err) {
        logger.error('Play/pause failed', { error: err });
        useContentHubStore.setState({ isPlaying });
      } finally {
        setControlLoading(false);
      }
    } else if (nowPlaying?.source === 'youtube' && youtubeControls) {
      // Control the YouTube iframe player directly
      if (isPlaying) {
        youtubeControls.pause();
      } else {
        youtubeControls.play();
      }
      useContentHubStore.setState({ isPlaying: !isPlaying });
    } else {
      useContentHubStore.setState({ isPlaying: !isPlaying });
    }
  }, [isPlaying, nowPlaying?.source, spotifyControls, youtubeControls]);

  const handlePlay = useCallback(
    (item: ContentItem) => {
      play(item);

      if (item.source === 'spotify' && item.sourceMetadata?.uri) {
        spotifyControls.play(item.sourceMetadata.uri as string);
      } else if (item.source === 'youtube') {
        // The YouTubePlayer component will auto-play via autoplay prop.
        // Just set the store state.
        useContentHubStore.setState({ isPlaying: true });
      } else {
        useContentHubStore.setState({ isPlaying: true });
      }
    },
    [play, spotifyControls]
  );

  const handleSeek = useCallback(
    (position: number) => {
      useContentHubStore.setState({ progress: position });
      if (nowPlaying?.source === 'spotify') {
        spotifyControls.seek(position);
      } else if (nowPlaying?.source === 'youtube' && youtubeControls) {
        // position is in ms, YouTube API expects seconds
        youtubeControls.seekTo(position / 1000);
      }
    },
    [nowPlaying?.source, spotifyControls, youtubeControls]
  );

  const handleNext = useCallback(async () => {
    if (nowPlaying?.source === 'spotify') {
      setControlLoading(true);
      try {
        await spotifyControls.next();
      } finally {
        setControlLoading(false);
      }
    } else {
      useContentHubStore.getState().next();
    }
  }, [nowPlaying?.source, spotifyControls]);

  const handlePrevious = useCallback(async () => {
    if (nowPlaying?.source === 'spotify') {
      setControlLoading(true);
      try {
        await spotifyControls.previous();
      } finally {
        setControlLoading(false);
      }
    } else {
      useContentHubStore.getState().previous();
    }
  }, [nowPlaying?.source, spotifyControls]);

  const handleShuffle = useCallback(async () => {
    if (nowPlaying?.source === 'spotify') {
      const newState = !shuffleState;
      useContentHubStore.setState({ shuffleState: newState });
      try {
        await spotifyControls.shuffle(newState);
      } catch (err) {
        logger.error('Shuffle toggle failed', { error: err });
        useContentHubStore.setState({ shuffleState: shuffleState });
      }
    } else {
      // For non-Spotify sources, toggle local shuffle state
      useContentHubStore.setState({ shuffleState: !shuffleState });
    }
  }, [nowPlaying?.source, shuffleState, spotifyControls]);

  const handleRepeat = useCallback(async () => {
    const nextState = repeatState === 'off' ? 'context' :
                      repeatState === 'context' ? 'track' : 'off';
    if (nowPlaying?.source === 'spotify') {
      useContentHubStore.setState({ repeatState: nextState });
      try {
        await spotifyControls.repeat(nextState);
      } catch (err) {
        logger.error('Repeat toggle failed', { error: err });
        useContentHubStore.setState({ repeatState: repeatState });
      }
    } else {
      // For non-Spotify sources, toggle local repeat state
      useContentHubStore.setState({ repeatState: nextState });
    }
  }, [nowPlaying?.source, repeatState, spotifyControls]);

  const handleVolumeChange = useCallback(async (volume: number) => {
    if (nowPlaying?.source === 'spotify') {
      try {
        await spotifyControls.setVolume(volume);
      } catch (err) {
        logger.error('Volume change failed', { error: err });
      }
    } else if (nowPlaying?.source === 'youtube' && youtubeControls) {
      youtubeControls.setVolume(volume);
    }
    // Always update store volume for UI consistency
    useContentHubStore.setState({ volume });
  }, [nowPlaying?.source, spotifyControls, youtubeControls]);

  return {
    controlLoading,
    handlePlayPause,
    handlePlay,
    handleSeek,
    handleNext,
    handlePrevious,
    handleShuffle,
    handleRepeat,
    handleVolumeChange,
    spotifyControls,
  };
}

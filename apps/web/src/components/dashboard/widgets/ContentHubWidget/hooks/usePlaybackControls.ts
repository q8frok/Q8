/**
 * usePlaybackControls Hook
 * Encapsulates playback control logic for ContentHub
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
    } else {
      useContentHubStore.setState({ isPlaying: !isPlaying });
    }
  }, [isPlaying, nowPlaying?.source, spotifyControls]);

  const handlePlay = useCallback(
    (item: ContentItem) => {
      play(item);
      
      if (item.source === 'spotify' && item.sourceMetadata?.uri) {
        // Play Spotify track via API
        spotifyControls.play(item.sourceMetadata.uri as string);
      } else if (item.source === 'youtube') {
        // For YouTube, we need to handle differently
        // The NowPlayingCard will show the embedded player
        // Set playing state to true
        useContentHubStore.setState({ isPlaying: true });
        
        // If there's a playback URL, we could also open it
        // But the embedded player in NowPlayingCard should handle it
      } else {
        // For other sources, set playing state
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
      }
    },
    [nowPlaying?.source, spotifyControls]
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
    }
  }, [nowPlaying?.source, shuffleState, spotifyControls]);

  const handleRepeat = useCallback(async () => {
    if (nowPlaying?.source === 'spotify') {
      const nextState = repeatState === 'off' ? 'context' : 
                        repeatState === 'context' ? 'track' : 'off';
      useContentHubStore.setState({ repeatState: nextState });
      try {
        await spotifyControls.repeat(nextState);
      } catch (err) {
        logger.error('Repeat toggle failed', { error: err });
        useContentHubStore.setState({ repeatState: repeatState });
      }
    }
  }, [nowPlaying?.source, repeatState, spotifyControls]);

  const handleVolumeChange = useCallback(async (volume: number) => {
    if (nowPlaying?.source === 'spotify') {
      try {
        await spotifyControls.setVolume(volume);
      } catch (err) {
        logger.error('Volume change failed', { error: err });
      }
    }
  }, [nowPlaying?.source, spotifyControls]);

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

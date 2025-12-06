'use client';

import { useEffect, useCallback } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';
import type { ContentItem } from '@/types/contenthub';

/**
 * Hook to manage ContentHub data fetching and synchronization
 */
export function useContentHub() {
  const {
    nowPlaying,
    isPlaying,
    activeMode,
    queue,
    play,
    pause,
    resume,
    setLoading,
    setError,
    addToQueue,
  } = useContentHubStore();

  // Demo content for when APIs aren't available
  const demoContent: ContentItem[] = [
    {
      id: 'demo-1',
      source: 'spotify',
      type: 'track',
      title: 'Blinding Lights',
      subtitle: 'The Weeknd',
      thumbnailUrl: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
      duration: 200000,
      playbackUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
      deepLinkUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
      sourceMetadata: { album: 'After Hours' },
    },
    {
      id: 'demo-2',
      source: 'youtube',
      type: 'video',
      title: 'Lofi Hip Hop Radio',
      subtitle: 'Lofi Girl',
      thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
      duration: 0,
      playbackUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      deepLinkUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      sourceMetadata: {},
    },
    {
      id: 'demo-3',
      source: 'spotify',
      type: 'track',
      title: 'Levitating',
      subtitle: 'Dua Lipa',
      thumbnailUrl: 'https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946',
      duration: 203000,
      playbackUrl: 'https://open.spotify.com/track/39LLxExYz6ewLAcYrzQQyP',
      deepLinkUrl: 'https://open.spotify.com/track/39LLxExYz6ewLAcYrzQQyP',
      sourceMetadata: { album: 'Future Nostalgia' },
    },
  ];

  // Fetch aggregated content from API
  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/contenthub?mode=${activeMode}&sources=spotify,youtube`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      const data = await response.json();

      // If there's content playing from Spotify, update store
      if (data.nowPlaying && !nowPlaying) {
        play(data.nowPlaying);
      }

      // Add trending items to queue if queue is empty
      if (queue.length === 0 && data.trending?.length > 0) {
        data.trending.slice(0, 5).forEach((item: ContentItem) => {
          addToQueue(item);
        });
      }

      setError(null);
    } catch (error) {
      console.warn('ContentHub fetch error, using demo content:', error);

      // Use demo content as fallback
      if (!nowPlaying && demoContent[0]) {
        play(demoContent[0]);
      }
      if (queue.length === 0) {
        demoContent.slice(1).forEach((item) => addToQueue(item));
      }
      setError(null); // Don't show error for demo mode
    } finally {
      setLoading(false);
    }
  }, [activeMode, nowPlaying, queue.length, play, addToQueue, setLoading, setError]);

  // Fetch Spotify playback state
  const fetchSpotifyState = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify');
      if (!response.ok) return;

      const data = await response.json();

      if (data.track) {
        const spotifyItem: ContentItem = {
          id: `spotify-${data.track.id}`,
          source: 'spotify',
          type: 'track',
          title: data.track.title,
          subtitle: data.track.artist,
          thumbnailUrl: data.track.albumArtUrl,
          duration: data.track.durationMs,
          playbackUrl: data.track.spotifyUrl,
          deepLinkUrl: data.track.spotifyUrl,
          sourceMetadata: {
            album: data.track.album,
            uri: `spotify:track:${data.track.id}`,
          },
        };

        // Update now playing if different
        if (!nowPlaying || nowPlaying.id !== spotifyItem.id) {
          play(spotifyItem);
        }

        // Update playing state
        if (data.isPlaying && !isPlaying) {
          resume();
        } else if (!data.isPlaying && isPlaying) {
          pause();
        }

        // Update progress
        if (data.progress) {
          useContentHubStore.setState({ progress: data.progress });
        }
      }
    } catch (error) {
      console.error('Spotify state fetch error:', error);
    }
  }, [nowPlaying, isPlaying, play, pause, resume]);

  // Control Spotify playback
  const controlSpotify = useCallback(async (action: string, params?: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });

      if (!response.ok) {
        throw new Error('Spotify control failed');
      }

      // Refresh state after action
      setTimeout(fetchSpotifyState, 500);
    } catch (error) {
      console.error('Spotify control error:', error);
      setError('Failed to control playback');
    }
  }, [fetchSpotifyState, setError]);

  // Search across sources
  const search = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    try {
      const response = await fetch(
        `/api/contenthub/search?q=${encodeURIComponent(query)}&sources=spotify,youtube&limit=10`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      return data.results as ContentItem[];
    } catch (error) {
      console.error('Search error:', error);
      setError('Search failed');
      return [];
    }
  }, [setError]);

  // Initial fetch on mount and mode change
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Poll Spotify state every 5 seconds when playing
  useEffect(() => {
    fetchSpotifyState();

    const interval = setInterval(fetchSpotifyState, 5000);
    return () => clearInterval(interval);
  }, [fetchSpotifyState]);

  return {
    fetchContent,
    fetchSpotifyState,
    controlSpotify,
    search,
  };
}

/**
 * Hook for Spotify-specific controls
 */
export function useSpotifyControls() {
  const { controlSpotify } = useContentHub();

  return {
    play: (uri?: string) => controlSpotify('play', uri ? { uri } : undefined),
    pause: () => controlSpotify('pause'),
    next: () => controlSpotify('next'),
    previous: () => controlSpotify('previous'),
    seek: (position: number) => controlSpotify('seek', { position }),
    setVolume: (volume: number) => controlSpotify('volume', { volume }),
    shuffle: (state: boolean) => controlSpotify('shuffle', { state }),
    repeat: (state: 'off' | 'track' | 'context') => controlSpotify('repeat', { state }),
  };
}

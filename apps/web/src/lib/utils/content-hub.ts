/**
 * Content Hub Utilities
 * Spotify and YouTube helpers
 */

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  uri: string;
  image_url?: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  url: string;
}

export interface QueueItem {
  id: string;
  type: 'spotify' | 'youtube';
  title: string;
  subtitle: string;
  thumbnail?: string;
  duration?: string;
  uri?: string;
  url?: string;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function parseYouTubeDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function spotifyTrackToQueueItem(track: SpotifyTrack): QueueItem {
  return {
    id: track.id,
    type: 'spotify',
    title: track.name,
    subtitle: track.artist,
    thumbnail: track.image_url,
    duration: formatDuration(track.duration_ms),
    uri: track.uri,
  };
}

export function youtubeVideoToQueueItem(video: YouTubeVideo): QueueItem {
  return {
    id: video.id,
    type: 'youtube',
    title: video.title,
    subtitle: video.channel,
    thumbnail: video.thumbnail,
    duration: video.duration,
    url: video.url,
  };
}

export function getSpotifyEmbedUrl(uri: string): string {
  const parts = uri.split(':');
  const type = parts[1];
  const id = parts[2];
  return `https://open.spotify.com/embed/${type}/${id}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

export function createSpotifySearchQuery(query: string, type: 'track' | 'album' | 'playlist' = 'track'): string {
  return `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=20`;
}

export function createYouTubeSearchQuery(query: string, maxResults: number = 20): string {
  return `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=video`;
}

export const CONTENT_MODES = {
  MUSIC: 'music',
  VIDEO: 'video',
  PODCAST: 'podcast',
  MIXED: 'mixed',
} as const;

export type ContentMode = typeof CONTENT_MODES[keyof typeof CONTENT_MODES];

export function getModeIcon(mode: ContentMode): string {
  const icons: Record<ContentMode, string> = {
    music: '🎵',
    video: '📺',
    podcast: '🎙️',
    mixed: '🎬',
  };
  return icons[mode];
}

export function getModeLabel(mode: ContentMode): string {
  const labels: Record<ContentMode, string> = {
    music: 'Music',
    video: 'Videos',
    podcast: 'Podcasts',
    mixed: 'All Content',
  };
  return labels[mode];
}

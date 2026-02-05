/**
 * Spotify Direct API Tools
 * Direct integration with Spotify Web API for playback control and search
 * Assigned to: Personality Agent (Grok 4.1 Fast)
 */

import { z } from 'zod';
import { createToolError, type ToolErrorResult } from '../utils/errors';
import { executeWithRetry } from '../utils/retry';
import type { ToolDefinition } from './default';

// =============================================================================
// Constants
// =============================================================================

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// =============================================================================
// Types
// =============================================================================

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
  };
  durationMs: number;
  popularity?: number;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  volumePercent: number;
  isActive: boolean;
}

// Search result types
export interface SpotifySearchSuccessResult {
  success: true;
  items: SpotifyTrack[];
  total: number;
  type: string;
}

export interface SpotifySearchErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type SpotifySearchResult = SpotifySearchSuccessResult | SpotifySearchErrorResult;

// Now playing result types
export interface SpotifyNowPlayingSuccessResult {
  success: true;
  isPlaying: boolean;
  track?: SpotifyTrack;
  progressMs?: number;
  device?: SpotifyDevice;
}

export interface SpotifyNowPlayingErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type SpotifyNowPlayingResult = SpotifyNowPlayingSuccessResult | SpotifyNowPlayingErrorResult;

// Playback control result types
export interface SpotifyPlaybackSuccessResult {
  success: true;
  action: string;
  uri?: string;
}

export interface SpotifyPlaybackErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type SpotifyPlaybackResult = SpotifyPlaybackSuccessResult | SpotifyPlaybackErrorResult;

// Devices result types
export interface SpotifyDevicesSuccessResult {
  success: true;
  devices: SpotifyDevice[];
}

export interface SpotifyDevicesErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type SpotifyDevicesResult = SpotifyDevicesSuccessResult | SpotifyDevicesErrorResult;

// Volume result types
export interface SpotifyVolumeSuccessResult {
  success: true;
  volumePercent: number;
}

export interface SpotifyVolumeErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type SpotifyVolumeResult = SpotifyVolumeSuccessResult | SpotifyVolumeErrorResult;

// =============================================================================
// Token Management
// =============================================================================

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Clear cached token (useful for testing)
 */
export function clearCachedToken(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

/**
 * Refresh the Spotify access token using the refresh token
 */
export async function refreshSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Spotify credentials not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Spotify token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  // Expire 5 minutes early to avoid edge cases
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return data.access_token;
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }
  return refreshSpotifyToken();
}

/**
 * Check if credentials are configured
 */
function hasCredentials(): boolean {
  return !!(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REFRESH_TOKEN
  );
}

/**
 * Create a missing credentials error result
 */
function missingCredentialsError(toolName: string): ToolErrorResult {
  return {
    success: false,
    message: "Spotify credentials are not configured. Please set up your Spotify API keys.",
    error: {
      code: 'MISSING_CREDENTIALS',
      recoverable: false,
      suggestion: 'Configure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN environment variables.',
    },
  };
}

/**
 * Make an authenticated API call to Spotify with automatic retry on 401
 */
async function spotifyApiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const token = await getAccessToken();

  const response = await executeWithRetry(
    async () => {
      const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle 401 by refreshing token and retrying once
      if (res.status === 401 && retryOn401) {
        // Force token refresh
        cachedAccessToken = null;
        const newToken = await refreshSpotifyToken();

        const retryRes = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });

        if (!retryRes.ok && retryRes.status !== 204) {
          throw new Error(`Spotify API error: ${retryRes.status} ${retryRes.statusText}`);
        }

        // 204 means success with no content
        if (retryRes.status === 204) {
          return null as T;
        }

        return retryRes.json() as T;
      }

      if (!res.ok && res.status !== 204) {
        throw new Error(`Spotify API error: ${res.status} ${res.statusText}`);
      }

      // 204 means success with no content
      if (res.status === 204) {
        return null as T;
      }

      return res.json() as T;
    },
    {
      maxRetries: 2,
      backoffMs: 500,
    }
  );

  return response;
}

// =============================================================================
// spotify_search
// =============================================================================

const spotifySearchParamsSchema = z.object({
  query: z.string().describe('The search query (e.g., "Bohemian Rhapsody", "Beatles")'),
  type: z
    .enum(['track', 'album', 'artist', 'playlist'])
    .default('track')
    .describe('The type of item to search for (default: track)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum number of results to return (default: 10, max: 50)'),
});

// Input type allows optional type and limit
type SpotifySearchParamsInput = z.input<typeof spotifySearchParamsSchema>;
// Output type has defaults applied
type SpotifySearchParams = z.output<typeof spotifySearchParamsSchema>;

interface SpotifySearchApiResponse {
  tracks?: {
    items: Array<{
      id: string;
      name: string;
      uri: string;
      artists: Array<{ id: string; name: string }>;
      album: { id: string; name: string; images: Array<{ url: string }> };
      duration_ms: number;
      popularity: number;
    }>;
    total: number;
  };
  albums?: { items: Array<unknown>; total: number };
  artists?: { items: Array<unknown>; total: number };
  playlists?: { items: Array<unknown>; total: number };
}

/**
 * Search for tracks, albums, artists, or playlists on Spotify
 */
export async function spotifySearch(
  params: SpotifySearchParamsInput
): Promise<SpotifySearchResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_search') as SpotifySearchErrorResult;
  }

  try {
    const { query, type = 'track', limit = 10 } = params;
    const searchParams = new URLSearchParams({
      q: query,
      type,
      limit: limit.toString(),
    });

    const data = await spotifyApiCall<SpotifySearchApiResponse>(
      `/search?${searchParams.toString()}`
    );

    // Handle track results (most common case)
    if (type === 'track' && data?.tracks) {
      const items: SpotifyTrack[] = data.tracks.items.map((item) => ({
        id: item.id,
        name: item.name,
        uri: item.uri,
        artists: item.artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: item.album.id,
          name: item.album.name,
          images: item.album.images,
        },
        durationMs: item.duration_ms,
        popularity: item.popularity,
      }));

      return {
        success: true,
        items,
        total: data.tracks.total,
        type,
      };
    }

    // For non-track types, return raw items for now
    const resultKey = `${type}s` as keyof SpotifySearchApiResponse;
    const results = data?.[resultKey] as { items: Array<unknown>; total: number } | undefined;

    return {
      success: true,
      items: (results?.items || []) as unknown as SpotifyTrack[],
      total: results?.total || 0,
      type,
    };
  } catch (error) {
    const toolError = createToolError('spotify_search', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifySearchDefinition: ToolDefinition<SpotifySearchParamsInput, SpotifySearchResult> = {
  name: 'spotify_search',
  description:
    'Search for tracks, albums, artists, or playlists on Spotify. Returns matching items with details like name, artist, and URI.',
  parameters: spotifySearchParamsSchema as z.ZodSchema<SpotifySearchParamsInput>,
  execute: spotifySearch as (args: SpotifySearchParamsInput) => Promise<SpotifySearchResult>,
};

// =============================================================================
// spotify_now_playing
// =============================================================================

const spotifyNowPlayingParamsSchema = z.object({});

type SpotifyNowPlayingParams = z.infer<typeof spotifyNowPlayingParamsSchema>;

interface SpotifyNowPlayingApiResponse {
  is_playing: boolean;
  progress_ms: number;
  item?: {
    id: string;
    name: string;
    uri: string;
    artists: Array<{ id: string; name: string }>;
    album: { id: string; name: string; images: Array<{ url: string }> };
    duration_ms: number;
  };
  device?: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
    is_active: boolean;
  };
}

/**
 * Get the currently playing track on Spotify
 */
export async function spotifyNowPlaying(
  _params: SpotifyNowPlayingParams = {}
): Promise<SpotifyNowPlayingResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_now_playing') as SpotifyNowPlayingErrorResult;
  }

  try {
    const data = await spotifyApiCall<SpotifyNowPlayingApiResponse | null>(
      '/me/player/currently-playing'
    );

    // No active playback (204 response returns null)
    if (!data) {
      return {
        success: true,
        isPlaying: false,
      };
    }

    const result: SpotifyNowPlayingSuccessResult = {
      success: true,
      isPlaying: data.is_playing,
    };

    if (data.item) {
      result.track = {
        id: data.item.id,
        name: data.item.name,
        uri: data.item.uri,
        artists: data.item.artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: data.item.album.id,
          name: data.item.album.name,
          images: data.item.album.images,
        },
        durationMs: data.item.duration_ms,
      };
    }

    if (data.progress_ms !== undefined) {
      result.progressMs = data.progress_ms;
    }

    if (data.device) {
      result.device = {
        id: data.device.id,
        name: data.device.name,
        type: data.device.type,
        volumePercent: data.device.volume_percent,
        isActive: data.device.is_active,
      };
    }

    return result;
  } catch (error) {
    const toolError = createToolError('spotify_now_playing', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifyNowPlayingDefinition: ToolDefinition<
  SpotifyNowPlayingParams,
  SpotifyNowPlayingResult
> = {
  name: 'spotify_now_playing',
  description:
    'Get information about the currently playing track on Spotify, including track details, playback progress, and the active device.',
  parameters: spotifyNowPlayingParamsSchema,
  execute: spotifyNowPlaying,
};

// =============================================================================
// spotify_play_pause
// =============================================================================

const spotifyPlayPauseParamsSchema = z.object({
  action: z
    .enum(['play', 'pause', 'toggle'])
    .describe('The playback action to perform: play, pause, or toggle'),
  uri: z
    .string()
    .optional()
    .describe('Spotify URI to play (e.g., spotify:track:xxx). Only used with play action.'),
  deviceId: z
    .string()
    .optional()
    .describe('The device ID to control. If not specified, the active device is used.'),
});

type SpotifyPlayPauseParams = z.infer<typeof spotifyPlayPauseParamsSchema>;

/**
 * Control Spotify playback (play, pause, or toggle)
 */
export async function spotifyPlayPause(
  params: SpotifyPlayPauseParams
): Promise<SpotifyPlaybackResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_play_pause') as SpotifyPlaybackErrorResult;
  }

  try {
    let { action } = params;
    const { uri, deviceId } = params;

    // Handle toggle by checking current state
    if (action === 'toggle') {
      const nowPlaying = await spotifyNowPlaying({});
      if (nowPlaying.success && 'isPlaying' in nowPlaying) {
        action = nowPlaying.isPlaying ? 'pause' : 'play';
      } else {
        action = 'play';
      }
    }

    const endpoint = action === 'play' ? '/me/player/play' : '/me/player/pause';
    const queryParams = deviceId ? `?device_id=${deviceId}` : '';

    const options: RequestInit = {
      method: 'PUT',
    };

    // Include URI in body for play action
    if (action === 'play' && uri) {
      options.body = JSON.stringify({
        uris: [uri],
      });
      options.headers = {
        'Content-Type': 'application/json',
      };
    }

    await spotifyApiCall<null>(`${endpoint}${queryParams}`, options);

    return {
      success: true,
      action,
      uri,
    };
  } catch (error) {
    const toolError = createToolError('spotify_play_pause', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifyPlayPauseDefinition: ToolDefinition<
  SpotifyPlayPauseParams,
  SpotifyPlaybackResult
> = {
  name: 'spotify_play_pause',
  description:
    'Control Spotify playback. Can play, pause, or toggle playback. Optionally specify a track URI to play or a specific device.',
  parameters: spotifyPlayPauseParamsSchema,
  execute: spotifyPlayPause,
};

// =============================================================================
// spotify_next_previous
// =============================================================================

const spotifyNextPreviousParamsSchema = z.object({
  direction: z.enum(['next', 'previous']).describe('Skip to the next or previous track'),
  deviceId: z
    .string()
    .optional()
    .describe('The device ID to control. If not specified, the active device is used.'),
});

type SpotifyNextPreviousParams = z.infer<typeof spotifyNextPreviousParamsSchema>;

/**
 * Skip to the next or previous track on Spotify
 */
export async function spotifyNextPrevious(
  params: SpotifyNextPreviousParams
): Promise<SpotifyPlaybackResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_next_previous') as SpotifyPlaybackErrorResult;
  }

  try {
    const { direction, deviceId } = params;
    const endpoint = `/me/player/${direction}`;
    const queryParams = deviceId ? `?device_id=${deviceId}` : '';

    await spotifyApiCall<null>(`${endpoint}${queryParams}`, {
      method: 'POST',
    });

    return {
      success: true,
      action: direction,
    };
  } catch (error) {
    const toolError = createToolError('spotify_next_previous', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifyNextPreviousDefinition: ToolDefinition<
  SpotifyNextPreviousParams,
  SpotifyPlaybackResult
> = {
  name: 'spotify_next_previous',
  description:
    'Skip to the next or previous track in the current playback queue.',
  parameters: spotifyNextPreviousParamsSchema,
  execute: spotifyNextPrevious,
};

// =============================================================================
// spotify_add_to_queue
// =============================================================================

const spotifyAddToQueueParamsSchema = z.object({
  uri: z.string().describe('Spotify URI of the track to add (e.g., spotify:track:xxx)'),
  deviceId: z
    .string()
    .optional()
    .describe('The device ID to add to queue on. If not specified, the active device is used.'),
});

type SpotifyAddToQueueParams = z.infer<typeof spotifyAddToQueueParamsSchema>;

/**
 * Add a track to the Spotify playback queue
 */
export async function spotifyAddToQueue(
  params: SpotifyAddToQueueParams
): Promise<SpotifyPlaybackResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_add_to_queue') as SpotifyPlaybackErrorResult;
  }

  try {
    const { uri, deviceId } = params;
    const queryParams = new URLSearchParams({
      uri,
      ...(deviceId && { device_id: deviceId }),
    });

    await spotifyApiCall<null>(`/me/player/queue?${queryParams.toString()}`, {
      method: 'POST',
    });

    return {
      success: true,
      action: 'add_to_queue',
      uri,
    };
  } catch (error) {
    const toolError = createToolError('spotify_add_to_queue', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifyAddToQueueDefinition: ToolDefinition<
  SpotifyAddToQueueParams,
  SpotifyPlaybackResult
> = {
  name: 'spotify_add_to_queue',
  description:
    'Add a track to the playback queue. The track will play after the current queue.',
  parameters: spotifyAddToQueueParamsSchema,
  execute: spotifyAddToQueue,
};

// =============================================================================
// spotify_get_devices
// =============================================================================

const spotifyGetDevicesParamsSchema = z.object({});

type SpotifyGetDevicesParams = z.infer<typeof spotifyGetDevicesParamsSchema>;

interface SpotifyDevicesApiResponse {
  devices: Array<{
    id: string;
    name: string;
    type: string;
    volume_percent: number;
    is_active: boolean;
  }>;
}

/**
 * Get available Spotify playback devices
 */
export async function spotifyGetDevices(
  _params: SpotifyGetDevicesParams = {}
): Promise<SpotifyDevicesResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_get_devices') as SpotifyDevicesErrorResult;
  }

  try {
    const data = await spotifyApiCall<SpotifyDevicesApiResponse>('/me/player/devices');

    const devices: SpotifyDevice[] = (data?.devices || []).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      volumePercent: d.volume_percent,
      isActive: d.is_active,
    }));

    return {
      success: true,
      devices,
    };
  } catch (error) {
    const toolError = createToolError('spotify_get_devices', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifyGetDevicesDefinition: ToolDefinition<
  SpotifyGetDevicesParams,
  SpotifyDevicesResult
> = {
  name: 'spotify_get_devices',
  description:
    'Get a list of available Spotify playback devices (speakers, phones, computers, etc.).',
  parameters: spotifyGetDevicesParamsSchema,
  execute: spotifyGetDevices,
};

// =============================================================================
// spotify_set_volume
// =============================================================================

const spotifySetVolumeParamsSchema = z.object({
  volumePercent: z
    .number()
    .describe('The volume level to set (0-100). Values outside this range will be clamped.'),
  deviceId: z
    .string()
    .optional()
    .describe('The device ID to set volume on. If not specified, the active device is used.'),
});

type SpotifySetVolumeParams = z.infer<typeof spotifySetVolumeParamsSchema>;

/**
 * Set the Spotify playback volume
 */
export async function spotifySetVolume(
  params: SpotifySetVolumeParams
): Promise<SpotifyVolumeResult> {
  if (!hasCredentials()) {
    return missingCredentialsError('spotify_set_volume') as SpotifyVolumeErrorResult;
  }

  try {
    const { volumePercent: rawVolume, deviceId } = params;
    // Clamp volume to 0-100
    const volumePercent = Math.max(0, Math.min(100, Math.round(rawVolume)));

    const queryParams = new URLSearchParams({
      volume_percent: volumePercent.toString(),
      ...(deviceId && { device_id: deviceId }),
    });

    await spotifyApiCall<null>(`/me/player/volume?${queryParams.toString()}`, {
      method: 'PUT',
    });

    return {
      success: true,
      volumePercent,
    };
  } catch (error) {
    const toolError = createToolError('spotify_set_volume', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const spotifySetVolumeDefinition: ToolDefinition<
  SpotifySetVolumeParams,
  SpotifyVolumeResult
> = {
  name: 'spotify_set_volume',
  description:
    'Set the playback volume on Spotify. Volume is a percentage from 0 to 100.',
  parameters: spotifySetVolumeParamsSchema,
  execute: spotifySetVolume,
};

// =============================================================================
// Export all Spotify tools
// =============================================================================

export const spotifyTools: ToolDefinition[] = [
  spotifySearchDefinition as ToolDefinition,
  spotifyNowPlayingDefinition as ToolDefinition,
  spotifyPlayPauseDefinition as ToolDefinition,
  spotifyNextPreviousDefinition as ToolDefinition,
  spotifyAddToQueueDefinition as ToolDefinition,
  spotifyGetDevicesDefinition as ToolDefinition,
  spotifySetVolumeDefinition as ToolDefinition,
];

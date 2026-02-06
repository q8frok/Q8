/**
 * Tests for Spotify Direct API Tools
 * TDD tests for Spotify playback control and search
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FunctionTool } from '@openai/agents';

// Import functions and types - will be created after tests
import {
  spotifySearch,
  spotifyNowPlaying,
  spotifyPlayPause,
  spotifyNextPrevious,
  spotifyAddToQueue,
  spotifyGetDevices,
  spotifySetVolume,
  spotifyTools,
  refreshSpotifyToken,
  clearCachedToken,
  type SpotifySearchResult,
  type SpotifyNowPlayingResult,
  type SpotifyPlaybackResult,
  type SpotifyDevicesResult,
  type SpotifyVolumeResult,
} from '@/lib/agents/sdk/tools/spotify';

// =============================================================================
// Type Guards
// =============================================================================

function isSearchSuccess(result: SpotifySearchResult): result is SpotifySearchResult & { success: true } {
  return result.success === true;
}

function isNowPlayingSuccess(result: SpotifyNowPlayingResult): result is SpotifyNowPlayingResult & { success: true } {
  return result.success === true;
}

function isPlaybackSuccess(result: SpotifyPlaybackResult): result is SpotifyPlaybackResult & { success: true } {
  return result.success === true;
}

function isDevicesSuccess(result: SpotifyDevicesResult): result is SpotifyDevicesResult & { success: true } {
  return result.success === true;
}

function isVolumeSuccess(result: SpotifyVolumeResult): result is SpotifyVolumeResult & { success: true } {
  return result.success === true;
}

// =============================================================================
// Mock Data
// =============================================================================

const mockTrackSearchResponse = {
  tracks: {
    items: [
      {
        id: 'track1',
        name: 'Test Song',
        uri: 'spotify:track:track1',
        artists: [{ id: 'artist1', name: 'Test Artist' }],
        album: { id: 'album1', name: 'Test Album', images: [{ url: 'https://image.url' }] },
        duration_ms: 240000,
        popularity: 85,
      },
    ],
    total: 1,
    limit: 10,
    offset: 0,
  },
};

const mockNowPlayingResponse = {
  is_playing: true,
  progress_ms: 60000,
  item: {
    id: 'track1',
    name: 'Currently Playing Song',
    uri: 'spotify:track:track1',
    artists: [{ id: 'artist1', name: 'Current Artist' }],
    album: { id: 'album1', name: 'Current Album', images: [{ url: 'https://image.url' }] },
    duration_ms: 240000,
  },
  device: {
    id: 'device1',
    name: 'My Speaker',
    type: 'Speaker',
    volume_percent: 50,
    is_active: true,
  },
};

const mockDevicesResponse = {
  devices: [
    {
      id: 'device1',
      name: 'My Speaker',
      type: 'Speaker',
      volume_percent: 50,
      is_active: true,
    },
    {
      id: 'device2',
      name: 'My Phone',
      type: 'Smartphone',
      volume_percent: 30,
      is_active: false,
    },
  ],
};

const mockTokenResponse = {
  access_token: 'new-access-token',
  token_type: 'Bearer',
  expires_in: 3600,
};

// =============================================================================
// Token Management Tests
// =============================================================================

describe('refreshSpotifyToken', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('successfully refreshes access token', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    } as Response);

    const token = await refreshSpotifyToken();
    expect(token).toBe('new-access-token');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    );
  });

  it('throws error when refresh token is missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    await expect(refreshSpotifyToken()).rejects.toThrow('Spotify credentials not configured');
  });

  it('throws error when client ID is missing', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', '');

    await expect(refreshSpotifyToken()).rejects.toThrow('Spotify credentials not configured');
  });

  it('throws error when client secret is missing', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '');

    await expect(refreshSpotifyToken()).rejects.toThrow('Spotify credentials not configured');
  });

  it('throws error on token refresh failure', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    } as Response);

    await expect(refreshSpotifyToken()).rejects.toThrow('Failed to refresh Spotify token');
  });
});

// =============================================================================
// spotify_search Tests
// =============================================================================

describe('spotifySearch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('searches for tracks successfully', async () => {
    // Mock token refresh
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      // Mock search API
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrackSearchResponse,
      } as Response);

    const result = await spotifySearch({ query: 'test song', type: 'track', limit: 10 });

    expect(result.success).toBe(true);
    if (isSearchSuccess(result)) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe('Test Song');
      expect(result.items[0]!.uri).toBe('spotify:track:track1');
    }
  });

  it('uses default type of track when not specified', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrackSearchResponse,
      } as Response);

    await spotifySearch({ query: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('type=track'),
      expect.anything()
    );
  });

  it('uses default limit of 10 when not specified', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrackSearchResponse,
      } as Response);

    await spotifySearch({ query: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.anything()
    );
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifySearch({ query: 'test' });

    expect(result.success).toBe(false);
    if (!isSearchSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('returns error on API failure', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

    const result = await spotifySearch({ query: 'test' });

    expect(result.success).toBe(false);
  });

  it('retries on 401 and refreshes token', async () => {
    vi.mocked(global.fetch)
      // First token
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      // First API call fails with 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response)
      // Second token refresh
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      // Second API call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrackSearchResponse,
      } as Response);

    const result = await spotifySearch({ query: 'test' });

    expect(result.success).toBe(true);
    // Should have called fetch 4 times: token, api, token, api
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});

// =============================================================================
// spotify_now_playing Tests
// =============================================================================

describe('spotifyNowPlaying', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns currently playing track', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNowPlayingResponse,
      } as Response);

    const result = await spotifyNowPlaying();

    expect(result.success).toBe(true);
    if (isNowPlayingSuccess(result)) {
      expect(result.isPlaying).toBe(true);
      expect(result.track?.name).toBe('Currently Playing Song');
      expect(result.track?.artists[0]!.name).toBe('Current Artist');
      expect(result.progressMs).toBe(60000);
    }
  });

  it('handles no active playback (204 response)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      } as Response);

    const result = await spotifyNowPlaying();

    expect(result.success).toBe(true);
    if (isNowPlayingSuccess(result)) {
      expect(result.isPlaying).toBe(false);
      expect(result.track).toBeUndefined();
    }
  });

  it('returns device information when available', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNowPlayingResponse,
      } as Response);

    const result = await spotifyNowPlaying();

    expect(result.success).toBe(true);
    if (isNowPlayingSuccess(result)) {
      expect(result.device?.name).toBe('My Speaker');
      expect(result.device?.volumePercent).toBe(50);
    }
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifyNowPlaying();

    expect(result.success).toBe(false);
    if (!isNowPlayingSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// spotify_play_pause Tests
// =============================================================================

describe('spotifyPlayPause', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pauses playback', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifyPlayPause({ action: 'pause' });

    expect(result.success).toBe(true);
    if (isPlaybackSuccess(result)) {
      expect(result.action).toBe('pause');
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/me/player/pause'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('plays playback', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifyPlayPause({ action: 'play' });

    expect(result.success).toBe(true);
    if (isPlaybackSuccess(result)) {
      expect(result.action).toBe('play');
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/me/player/play'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('plays specific URI', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    await spotifyPlayPause({ action: 'play', uri: 'spotify:track:abc123' });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/me/player/play'),
      expect.objectContaining({
        body: expect.stringContaining('spotify:track:abc123'),
      })
    );
  });

  it('plays with specific device', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    await spotifyPlayPause({ action: 'play', deviceId: 'device123' });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('device_id=device123'),
      expect.anything()
    );
  });

  it('toggles playback based on current state', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      // Now playing check
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNowPlayingResponse,
      } as Response)
      // Pause action (since is_playing is true)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifyPlayPause({ action: 'toggle' });

    expect(result.success).toBe(true);
    if (isPlaybackSuccess(result)) {
      expect(result.action).toBe('pause');
    }
  });

  it('returns error when no active device', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

    const result = await spotifyPlayPause({ action: 'play' });

    expect(result.success).toBe(false);
    if (!isPlaybackSuccess(result)) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifyPlayPause({ action: 'play' });

    expect(result.success).toBe(false);
    if (!isPlaybackSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// spotify_next_previous Tests
// =============================================================================

describe('spotifyNextPrevious', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips to next track', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifyNextPrevious({ direction: 'next' });

    expect(result.success).toBe(true);
    if (isPlaybackSuccess(result)) {
      expect(result.action).toBe('next');
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/me/player/next'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('skips to previous track', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifyNextPrevious({ direction: 'previous' });

    expect(result.success).toBe(true);
    if (isPlaybackSuccess(result)) {
      expect(result.action).toBe('previous');
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/me/player/previous'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses device ID when provided', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    await spotifyNextPrevious({ direction: 'next', deviceId: 'device123' });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('device_id=device123'),
      expect.anything()
    );
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifyNextPrevious({ direction: 'next' });

    expect(result.success).toBe(false);
    if (!isPlaybackSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// spotify_add_to_queue Tests
// =============================================================================

describe('spotifyAddToQueue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adds track to queue', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifyAddToQueue({ uri: 'spotify:track:abc123' });

    expect(result.success).toBe(true);
    if (isPlaybackSuccess(result)) {
      expect(result.action).toBe('add_to_queue');
      expect(result.uri).toBe('spotify:track:abc123');
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('uri=spotify%3Atrack%3Aabc123'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses device ID when provided', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    await spotifyAddToQueue({ uri: 'spotify:track:abc123', deviceId: 'device123' });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('device_id=device123'),
      expect.anything()
    );
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifyAddToQueue({ uri: 'spotify:track:abc123' });

    expect(result.success).toBe(false);
    if (!isPlaybackSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// spotify_get_devices Tests
// =============================================================================

describe('spotifyGetDevices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns list of devices', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevicesResponse,
      } as Response);

    const result = await spotifyGetDevices();

    expect(result.success).toBe(true);
    if (isDevicesSuccess(result)) {
      expect(result.devices).toHaveLength(2);
      expect(result.devices[0]!.name).toBe('My Speaker');
      expect(result.devices[0]!.isActive).toBe(true);
      expect(result.devices[1]!.name).toBe('My Phone');
      expect(result.devices[1]!.isActive).toBe(false);
    }
  });

  it('returns empty list when no devices available', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ devices: [] }),
      } as Response);

    const result = await spotifyGetDevices();

    expect(result.success).toBe(true);
    if (isDevicesSuccess(result)) {
      expect(result.devices).toHaveLength(0);
    }
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifyGetDevices();

    expect(result.success).toBe(false);
    if (!isDevicesSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// spotify_set_volume Tests
// =============================================================================

describe('spotifySetVolume', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearCachedToken();
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', 'test-refresh-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets volume to specified percentage', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifySetVolume({ volumePercent: 75 });

    expect(result.success).toBe(true);
    if (isVolumeSuccess(result)) {
      expect(result.volumePercent).toBe(75);
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('volume_percent=75'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('clamps volume to 0-100 range (low)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifySetVolume({ volumePercent: -10 });

    expect(result.success).toBe(true);
    if (isVolumeSuccess(result)) {
      expect(result.volumePercent).toBe(0);
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('volume_percent=0'),
      expect.anything()
    );
  });

  it('clamps volume to 0-100 range (high)', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    const result = await spotifySetVolume({ volumePercent: 150 });

    expect(result.success).toBe(true);
    if (isVolumeSuccess(result)) {
      expect(result.volumePercent).toBe(100);
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('volume_percent=100'),
      expect.anything()
    );
  });

  it('uses device ID when provided', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

    await spotifySetVolume({ volumePercent: 50, deviceId: 'device123' });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('device_id=device123'),
      expect.anything()
    );
  });

  it('returns error when credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_REFRESH_TOKEN', '');

    const result = await spotifySetVolume({ volumePercent: 50 });

    expect(result.success).toBe(false);
    if (!isVolumeSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// Tool Definitions Tests
// =============================================================================

describe('spotifyTools', () => {
  it('exports an array of all Spotify tools', () => {
    expect(Array.isArray(spotifyTools)).toBe(true);
    expect(spotifyTools.length).toBe(7);
  });

  it('all tools have required properties', () => {
    for (const t of spotifyTools) {
      const ft = t as FunctionTool;
      expect(ft).toHaveProperty('name');
      expect(ft).toHaveProperty('description');
      expect(ft).toHaveProperty('parameters');
      expect(ft).toHaveProperty('invoke');
      expect(typeof ft.name).toBe('string');
      expect(typeof ft.description).toBe('string');
      expect(typeof ft.invoke).toBe('function');
    }
  });

  it('tool names are unique', () => {
    const names = spotifyTools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('includes spotify_search tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_search') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('Search');
  });

  it('includes spotify_now_playing tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_now_playing') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('playing');
  });

  it('includes spotify_play_pause tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_play_pause') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('playback');
  });

  it('includes spotify_next_previous tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_next_previous') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('next');
  });

  it('includes spotify_add_to_queue tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_add_to_queue') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('queue');
  });

  it('includes spotify_get_devices tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_get_devices') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('devices');
  });

  it('includes spotify_set_volume tool', () => {
    const t = spotifyTools.find((t) => t.name === 'spotify_set_volume') as FunctionTool;
    expect(t).toBeDefined();
    expect(t.description).toContain('volume');
  });
});

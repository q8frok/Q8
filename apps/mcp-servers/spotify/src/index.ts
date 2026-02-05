/**
 * Spotify MCP Server
 *
 * Provides Spotify playback control and search tools via MCP protocol.
 * Implements OAuth 2.0 with PKCE for secure authentication.
 *
 * Environment Variables Required:
 * - SPOTIFY_CLIENT_ID
 * - SPOTIFY_CLIENT_SECRET (optional for PKCE flow)
 * - SPOTIFY_REDIRECT_URI
 * - SPOTIFY_REFRESH_TOKEN (obtained after initial OAuth flow)
 */

import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// =============================================================================
// Types
// =============================================================================

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  uri: string;
  duration_ms: number;
}

interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device: { id: string; name: string; type: string; volume_percent: number } | null;
}

// =============================================================================
// OAuth2 State
// =============================================================================

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Store PKCE verifier temporarily (in production, use session storage)
const pkceVerifiers = new Map<string, string>();

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) return false;

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', await response.text());
      return false;
    }

    const tokens: SpotifyTokens = await response.json();
    accessToken = tokens.access_token;
    tokenExpiresAt = Date.now() + tokens.expires_in * 1000 - 60000; // Refresh 1 min early

    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

/**
 * Get valid access token (refreshing if needed)
 */
async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const refreshed = await refreshAccessToken();
  return refreshed ? accessToken : null;
}

/**
 * Make authenticated Spotify API request
 */
async function spotifyApi(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated - please complete OAuth flow');
  }

  const url = `https://api.spotify.com/v1${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 204) {
    return { success: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// OAuth Routes
// =============================================================================

/**
 * Generate OAuth consent URL with PKCE
 */
app.get('/auth/url', (_req, res) => {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Store verifier for later exchange
  pkceVerifiers.set(state, verifier);

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
  ];

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
    scope: scopes.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params}`;
  res.json({ authUrl, state });
});

/**
 * Handle OAuth callback and exchange code for tokens
 */
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  const verifier = pkceVerifiers.get(state);
  if (!verifier) {
    return res.status(400).json({ error: 'Invalid state - PKCE verifier not found' });
  }

  pkceVerifiers.delete(state);

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error: `Token exchange failed: ${error}` });
    }

    const tokens: SpotifyTokens = await response.json();
    accessToken = tokens.access_token;
    tokenExpiresAt = Date.now() + tokens.expires_in * 1000 - 60000;

    res.json({
      message: 'Authorization successful',
      refreshToken: tokens.refresh_token,
      note: 'Store the refresh token in your .env as SPOTIFY_REFRESH_TOKEN',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Token exchange failed: ${message}` });
  }
});

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS = [
  {
    name: 'spotify_search',
    description: 'Search for tracks, albums, artists, or playlists',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        type: {
          type: 'string',
          enum: ['track', 'album', 'artist', 'playlist'],
          description: 'Type of content to search (default: track)',
        },
        limit: { type: 'number', description: 'Max results (default: 10, max: 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'spotify_now_playing',
    description: 'Get the currently playing track and playback state',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'spotify_play_pause',
    description: 'Toggle playback or explicitly play/pause',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'toggle'],
          description: 'Action to perform (default: toggle)',
        },
        uri: { type: 'string', description: 'Spotify URI to play (track, album, playlist)' },
        deviceId: { type: 'string', description: 'Target device ID' },
      },
    },
  },
  {
    name: 'spotify_next_previous',
    description: 'Skip to next or previous track',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['next', 'previous'],
          description: 'Direction to skip',
        },
        deviceId: { type: 'string', description: 'Target device ID' },
      },
      required: ['direction'],
    },
  },
  {
    name: 'spotify_add_to_queue',
    description: 'Add a track to the playback queue',
    inputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'Spotify track URI (e.g., spotify:track:...)' },
        deviceId: { type: 'string', description: 'Target device ID' },
      },
      required: ['uri'],
    },
  },
  {
    name: 'spotify_get_devices',
    description: 'List available Spotify playback devices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'spotify_set_volume',
    description: 'Set playback volume',
    inputSchema: {
      type: 'object',
      properties: {
        volume: { type: 'number', description: 'Volume level (0-100)' },
        deviceId: { type: 'string', description: 'Target device ID' },
      },
      required: ['volume'],
    },
  },
];

app.get('/tools', (_req, res) => {
  res.json(TOOLS);
});

// =============================================================================
// Tool Implementations
// =============================================================================

interface ToolParams {
  query?: string;
  type?: 'track' | 'album' | 'artist' | 'playlist';
  limit?: number;
  action?: 'play' | 'pause' | 'toggle';
  uri?: string;
  deviceId?: string;
  direction?: 'next' | 'previous';
  volume?: number;
}

async function executeSearch(params: ToolParams) {
  if (!params.query) throw new Error('query is required');

  const type = params.type || 'track';
  const limit = Math.min(params.limit || 10, 50);

  const searchParams = new URLSearchParams({
    q: params.query,
    type,
    limit: limit.toString(),
  });

  return spotifyApi(`/search?${searchParams}`);
}

async function executeNowPlaying(): Promise<SpotifyPlaybackState | null> {
  try {
    const state = (await spotifyApi('/me/player')) as SpotifyPlaybackState;
    return state;
  } catch (error) {
    // 204 No Content means no active playback
    if (error instanceof Error && error.message.includes('204')) {
      return null;
    }
    throw error;
  }
}

async function executePlayPause(params: ToolParams) {
  const action = params.action || 'toggle';
  const state = await executeNowPlaying();

  let shouldPlay = true;
  if (action === 'toggle') {
    shouldPlay = !state?.is_playing;
  } else {
    shouldPlay = action === 'play';
  }

  const endpoint = shouldPlay ? '/me/player/play' : '/me/player/pause';
  const deviceParam = params.deviceId ? `?device_id=${params.deviceId}` : '';

  const body: Record<string, unknown> | undefined = shouldPlay && params.uri ? { uris: [params.uri] } : undefined;

  await spotifyApi(`${endpoint}${deviceParam}`, 'PUT', body);
  return { success: true, action: shouldPlay ? 'play' : 'pause' };
}

async function executeNextPrevious(params: ToolParams) {
  if (!params.direction) throw new Error('direction is required');

  const endpoint = params.direction === 'next' ? '/me/player/next' : '/me/player/previous';
  const deviceParam = params.deviceId ? `?device_id=${params.deviceId}` : '';

  await spotifyApi(`${endpoint}${deviceParam}`, 'POST');
  return { success: true, direction: params.direction };
}

async function executeAddToQueue(params: ToolParams) {
  if (!params.uri) throw new Error('uri is required');

  const queryParams = new URLSearchParams({ uri: params.uri });
  if (params.deviceId) queryParams.set('device_id', params.deviceId);

  await spotifyApi(`/me/player/queue?${queryParams}`, 'POST');
  return { success: true, addedUri: params.uri };
}

async function executeGetDevices() {
  return spotifyApi('/me/player/devices');
}

async function executeSetVolume(params: ToolParams) {
  if (params.volume === undefined) throw new Error('volume is required');

  const volume = Math.max(0, Math.min(100, Math.round(params.volume)));
  const queryParams = new URLSearchParams({ volume_percent: volume.toString() });
  if (params.deviceId) queryParams.set('device_id', params.deviceId);

  await spotifyApi(`/me/player/volume?${queryParams}`, 'PUT');
  return { success: true, volume };
}

// =============================================================================
// Execute Endpoint
// =============================================================================

app.post('/execute', async (req, res) => {
  const { tool, params } = req.body;

  if (!process.env.SPOTIFY_REFRESH_TOKEN && !accessToken) {
    return res.status(401).json({
      error: 'Not authenticated',
      authUrl: '/auth/url',
      message: 'Please complete OAuth flow first',
    });
  }

  try {
    let result: unknown;

    switch (tool) {
      case 'spotify_search':
        result = await executeSearch(params);
        break;
      case 'spotify_now_playing':
        result = await executeNowPlaying();
        break;
      case 'spotify_play_pause':
        result = await executePlayPause(params);
        break;
      case 'spotify_next_previous':
        result = await executeNextPrevious(params);
        break;
      case 'spotify_add_to_queue':
        result = await executeAddToQueue(params);
        break;
      case 'spotify_get_devices':
        result = await executeGetDevices();
        break;
      case 'spotify_set_volume':
        result = await executeSetVolume(params);
        break;
      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }

    res.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Tool execution error (${tool}):`, error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Health Check
// =============================================================================

app.get('/health', async (_req, res) => {
  const token = await getAccessToken();
  res.json({
    status: 'ok',
    authenticated: !!token,
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Spotify MCP Server running on port ${PORT}`);
  if (!process.env.SPOTIFY_REFRESH_TOKEN) {
    console.log('⚠️  Not authenticated. Visit /auth/url to start OAuth flow.');
  }
});

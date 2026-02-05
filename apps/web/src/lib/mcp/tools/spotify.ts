/**
 * Spotify MCP Tool Definitions
 * Wrappers for Spotify playback control and search
 */

import { mcpClient } from '../client';
import { MCP_CONFIG } from '../config';
import { logger } from '@/lib/logger';

/** Track if Spotify server has been registered */
let spotifyInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensure Spotify MCP server is registered (lazy initialization)
 */
async function ensureInitialized(): Promise<void> {
  if (spotifyInitialized) return;

  // Prevent multiple simultaneous initialization attempts
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      const url = MCP_CONFIG.spotify.url();
      logger.debug('Registering Spotify MCP server', { url });
      await mcpClient.registerServer('spotify', url);
      spotifyInitialized = true;
      logger.info('Spotify MCP server registered successfully');
    } catch (error) {
      initPromise = null; // Allow retry on failure
      throw error;
    }
  })();

  await initPromise;
}

/**
 * Initialize Spotify MCP tools
 */
export async function initSpotifyTools() {
  await ensureInitialized();
  return mcpClient.getServerTools('spotify');
}

/**
 * Search for tracks, albums, artists, or playlists
 */
export async function searchSpotify(
  query: string,
  type: 'track' | 'album' | 'artist' | 'playlist' = 'track',
  limit: number = 10
) {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_search', { query, type, limit });
}

/**
 * Get currently playing track and playback state
 */
export async function getNowPlaying() {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_now_playing', {});
}

/**
 * Control playback (play, pause, toggle)
 */
export async function controlPlayback(
  action: 'play' | 'pause' | 'toggle' = 'toggle',
  uri?: string,
  deviceId?: string
) {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_play_pause', { action, uri, deviceId });
}

/**
 * Skip to next or previous track
 */
export async function skipTrack(
  direction: 'next' | 'previous',
  deviceId?: string
) {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_next_previous', { direction, deviceId });
}

/**
 * Add a track to the playback queue
 */
export async function addToQueue(uri: string, deviceId?: string) {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_add_to_queue', { uri, deviceId });
}

/**
 * Get available playback devices
 */
export async function getDevices() {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_get_devices', {});
}

/**
 * Set playback volume
 */
export async function setVolume(volume: number, deviceId?: string) {
  await ensureInitialized();
  return mcpClient.executeTool('spotify_set_volume', { volume, deviceId });
}

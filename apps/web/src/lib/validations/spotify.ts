/**
 * Spotify API validation schemas
 */
import { z } from 'zod';

export const spotifyActionEnum = z.enum([
  'play',
  'pause',
  'next',
  'previous',
  'shuffle',
  'repeat',
  'volume',
  'seek',
  'transfer',
]);

export const repeatStateEnum = z.enum(['off', 'track', 'context']);

export const spotifyControlSchema = z.object({
  action: spotifyActionEnum,
  device_id: z.string().optional(),
  uri: z.string().optional(), // Spotify URI for play
  context_uri: z.string().optional(), // Playlist/album URI
  offset: z.number().int().min(0).optional(), // Track offset in context
  state: z.union([z.boolean(), repeatStateEnum]).optional(), // For shuffle/repeat
  volume: z.number().int().min(0).max(100).optional(),
  position: z.number().int().min(0).optional(), // For seek (ms)
  play: z.boolean().optional(), // For transfer
});

export const spotifySearchSchema = z.object({
  query: z.string().min(1).max(200),
  type: z.enum(['track', 'album', 'artist', 'playlist']).default('track'),
  limit: z.number().int().min(1).max(50).default(20),
});

export const spotifyLibrarySchema = z.object({
  type: z.enum(['tracks', 'albums', 'playlists']).default('tracks'),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const spotifyAddToLibrarySchema = z.object({
  type: z.enum(['track', 'album']),
  ids: z.array(z.string()).min(1).max(50),
});

export const spotifyRemoveFromLibrarySchema = z.object({
  type: z.enum(['track', 'album']),
  ids: z.array(z.string()).min(1).max(50),
});

export type SpotifyControlInput = z.infer<typeof spotifyControlSchema>;
export type SpotifySearchInput = z.infer<typeof spotifySearchSchema>;
export type SpotifyLibraryInput = z.infer<typeof spotifyLibrarySchema>;
export type SpotifyAddToLibraryInput = z.infer<typeof spotifyAddToLibrarySchema>;

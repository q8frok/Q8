/**
 * AI-Powered Content Recommendation API
 *
 * Uses AI to analyze user context (mode, time, history) and generate
 * personalized music recommendations via Spotify's API.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

// Default fallback for unknown modes
const DEFAULT_MODE_CONFIG = {
  genres: ['pop', 'indie', 'electronic', 'alternative', 'hip-hop'],
  energy: 0.5,
  valence: 0.5,
} as const;

// Mode to genre/energy mapping for fallback
const MODE_DEFAULTS: Record<string, { genres: string[]; energy: number; valence: number }> = {
  focus: {
    genres: ['ambient', 'classical', 'study', 'piano', 'electronic'],
    energy: 0.3,
    valence: 0.4,
  },
  workout: {
    genres: ['edm', 'hip-hop', 'dance', 'pop', 'electronic'],
    energy: 0.9,
    valence: 0.8,
  },
  sleep: {
    genres: ['ambient', 'sleep', 'chill', 'acoustic', 'piano'],
    energy: 0.1,
    valence: 0.3,
  },
  break: {
    genres: ['pop', 'indie', 'alternative', 'rock', 'r-n-b'],
    energy: 0.6,
    valence: 0.7,
  },
  discover: {
    genres: ['pop', 'indie', 'electronic', 'alternative', 'hip-hop'],
    energy: 0.5,
    valence: 0.5,
  },
};

interface RecommendRequest {
  mode: string;
  currentTrack?: {
    id: string;
    title: string;
    artist: string;
  };
  recentHistory?: Array<{
    id: string;
    title: string;
    artist: string;
  }>;
  timeOfDay?: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  uri: string;
  external_urls: { spotify: string };
}

async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

async function getAIRecommendationSeeds(
  mode: string,
  currentTrack?: RecommendRequest['currentTrack'],
  recentHistory?: RecommendRequest['recentHistory'],
  timeOfDay?: string
): Promise<{ genres: string[]; energy: number; valence: number; seedTracks: string[] }> {
  const openaiKey = process.env.OPENAI_API_KEY;

  // Fallback if no API key
  if (!openaiKey) {
    const defaults = MODE_DEFAULTS[mode] ?? DEFAULT_MODE_CONFIG;
    return {
      genres: [...defaults.genres],
      energy: defaults.energy,
      valence: defaults.valence,
      seedTracks: [],
    };
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  const systemPrompt = `You are a music curator AI. Given a user's listening mode, current time, and recent listening history,
suggest optimal Spotify seed genres and audio features for personalized recommendations.

Available Spotify genres (use only these): acoustic, afrobeat, alt-rock, alternative, ambient, anime,
black-metal, bluegrass, blues, bossanova, brazil, breakbeat, british, cantopop, chicago-house,
children, chill, classical, club, comedy, country, dance, dancehall, death-metal, deep-house,
detroit-techno, disco, disney, drum-and-bass, dub, dubstep, edm, electro, electronic, emo, folk,
forro, french, funk, garage, german, gospel, goth, grindcore, groove, grunge, guitar, happy,
hard-rock, hardcore, hardstyle, heavy-metal, hip-hop, holidays, honky-tonk, house, idm, indian,
indie, indie-pop, industrial, iranian, j-dance, j-idol, j-pop, j-rock, jazz, k-pop, kids, latin,
latino, malay, mandopop, metal, metal-misc, metalcore, minimal-techno, movies, mpb, new-age,
new-release, opera, pagode, party, philippines-opm, piano, pop, pop-film, post-dubstep, power-pop,
progressive-house, psych-rock, punk, punk-rock, r-n-b, rainy-day, reggae, reggaeton, road-trip,
rock, rock-n-roll, rockabilly, romance, sad, salsa, samba, sertanejo, show-tunes, singer-songwriter,
ska, sleep, songwriter, soul, soundtracks, spanish, study, summer, swedish, synth-pop, tango,
techno, trance, trip-hop, turkish, work-out, world-music.

Respond with JSON only: { "genres": ["genre1", "genre2", "genre3"], "energy": 0.0-1.0, "valence": 0.0-1.0, "seedTrackIds": [] }`;

  const userPrompt = `Mode: ${mode}
Time of day: ${timeOfDay || 'unknown'}
${currentTrack ? `Currently playing: "${currentTrack.title}" by ${currentTrack.artist}` : 'Nothing currently playing'}
${recentHistory?.length ? `Recent tracks: ${recentHistory.slice(0, 5).map(t => `"${t.title}" by ${t.artist}`).join(', ')}` : 'No recent history'}

Based on this context, suggest 3-5 Spotify seed genres and appropriate energy/valence values.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    const parsed = JSON.parse(content);
    return {
      genres: parsed.genres?.slice(0, 5) || MODE_DEFAULTS[mode]?.genres || ['pop'],
      energy: parsed.energy ?? 0.5,
      valence: parsed.valence ?? 0.5,
      seedTracks: parsed.seedTrackIds || [],
    };
  } catch (error) {
    logger.error('AI recommendation error', { error: error });
    const defaults = MODE_DEFAULTS[mode] ?? DEFAULT_MODE_CONFIG;
    return {
      genres: [...defaults.genres],
      energy: defaults.energy,
      valence: defaults.valence,
      seedTracks: [],
    };
  }
}

export async function POST(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body: RecommendRequest = await request.json();
    const { mode, currentTrack, recentHistory, timeOfDay } = body;

    // Get AI-powered seed suggestions
    const seeds = await getAIRecommendationSeeds(mode, currentTrack, recentHistory, timeOfDay);

    // Get Spotify access token
    const accessToken = await getSpotifyAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Spotify not configured',
        recommendations: [],
      });
    }

    // Build Spotify recommendations request
    const params = new URLSearchParams({
      limit: '8',
      seed_genres: seeds.genres.slice(0, 5).join(','),
      target_energy: seeds.energy.toString(),
      target_valence: seeds.valence.toString(),
    });

    // Add seed tracks if available (from current/recent)
    const seedTrackIds: string[] = [];
    if (currentTrack?.id && currentTrack.id.startsWith('spotify-')) {
      seedTrackIds.push(currentTrack.id.replace('spotify-', ''));
    }
    if (recentHistory?.length) {
      recentHistory.slice(0, 2).forEach((track) => {
        if (track.id.startsWith('spotify-')) {
          seedTrackIds.push(track.id.replace('spotify-', ''));
        }
      });
    }

    // Spotify allows max 5 seeds total (genres + tracks + artists)
    // If we have seed tracks, reduce genres to fit
    if (seedTrackIds.length > 0) {
      const maxGenres = 5 - Math.min(seedTrackIds.length, 2);
      params.set('seed_genres', seeds.genres.slice(0, maxGenres).join(','));
      params.set('seed_tracks', seedTrackIds.slice(0, 2).join(','));
    }

    // Fetch recommendations from Spotify
    const response = await fetch(
      `${SPOTIFY_API_BASE}/recommendations?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Spotify recommendations error', { errorText: errorText });
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recommendations',
        recommendations: [],
      });
    }

    const data = await response.json();
    const tracks: SpotifyTrack[] = data.tracks || [];

    // Transform to ContentItem format
    const recommendations = tracks.map((track) => ({
      id: `spotify-${track.id}`,
      source: 'spotify' as const,
      type: 'track' as const,
      title: track.name,
      subtitle: track.artists.map((a) => a.name).join(', '),
      thumbnailUrl: track.album.images[0]?.url || '',
      duration: track.duration_ms,
      playbackUrl: track.external_urls.spotify,
      deepLinkUrl: track.external_urls.spotify,
      sourceMetadata: {
        uri: track.uri,
        album: track.album.name,
      },
    }));

    return NextResponse.json({
      success: true,
      recommendations,
      context: {
        mode,
        genres: seeds.genres,
        energy: seeds.energy,
        valence: seeds.valence,
      },
    });
  } catch (error) {
    logger.error('AI recommendation error', { error: error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations',
        recommendations: [],
      },
      { status: 500 }
    );
  }
}

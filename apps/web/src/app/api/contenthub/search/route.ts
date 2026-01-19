import { NextRequest, NextResponse } from 'next/server';
import type { ContentItem, ContentSource } from '@/types/contenthub';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';

/**
 * ContentHub Search API - Unified Search Across Sources
 *
 * Searches multiple content sources simultaneously and aggregates results.
 */

interface SearchResults {
  query: string;
  results: ContentItem[];
  sources: {
    [key in ContentSource]?: {
      count: number;
      error?: string;
    };
  };
  totalCount: number;
}

// Environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * GET /api/contenthub/search?q=query&sources=spotify,youtube&limit=20
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const sourcesParam = searchParams.get('sources') ?? 'spotify,youtube';
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  const sources = sourcesParam.split(',') as ContentSource[];

  const results: SearchResults = {
    query,
    results: [],
    sources: {},
    totalCount: 0,
  };

  // Search all requested sources in parallel
  const searches: Promise<ContentItem[]>[] = [];

  if (sources.includes('spotify')) {
    searches.push(
      searchSpotify(query, limit).catch((error) => {
        results.sources.spotify = { count: 0, error: error.message };
        return [];
      })
    );
  }

  if (sources.includes('youtube')) {
    searches.push(
      searchYouTube(query, limit).catch((error) => {
        results.sources.youtube = { count: 0, error: error.message };
        return [];
      })
    );
  }

  const searchResults = await Promise.all(searches);

  // Merge and interleave results
  for (let i = 0; i < searchResults.length; i++) {
    const sourceResults = searchResults[i];
    const source = sources[i];

    if (sourceResults && source && sourceResults.length > 0) {
      results.sources[source] = { count: sourceResults.length };
      results.results.push(...sourceResults);
    }
  }

  // Sort by relevance (simple: exact title matches first)
  results.results.sort((a, b) => {
    const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    return bExact - aExact;
  });

  results.totalCount = results.results.length;

  return NextResponse.json(results);
}

/**
 * Search Spotify for tracks, albums, and artists
 */
async function searchSpotify(query: string, limit: number): Promise<ContentItem[]> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured');
  }

  // Get access token
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get Spotify token');
  }

  const { access_token } = await tokenResponse.json();

  // Search tracks
  const searchResponse = await fetch(
    `https://api.spotify.com/v1/search?` +
      new URLSearchParams({
        q: query,
        type: 'track',
        limit: limit.toString(),
        market: 'US',
      }),
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error(`Spotify search failed: ${searchResponse.status}`);
  }

  const data = await searchResponse.json();
  const results: ContentItem[] = [];

  if (data.tracks?.items) {
    for (const track of data.tracks.items) {
      results.push({
        id: `spotify-${track.id}`,
        source: 'spotify',
        type: 'track',
        title: track.name,
        subtitle: track.artists.map((a: { name: string }) => a.name).join(', '),
        thumbnailUrl: track.album.images[0]?.url ?? '',
        duration: track.duration_ms,
        playbackUrl: track.external_urls.spotify,
        deepLinkUrl: track.external_urls.spotify,
        sourceMetadata: {
          uri: track.uri,
          album: track.album.name,
          albumId: track.album.id,
          artistIds: track.artists.map((a: { id: string }) => a.id),
          popularity: track.popularity,
          explicit: track.explicit,
          previewUrl: track.preview_url,
        },
      });
    }
  }

  return results;
}

/**
 * Search YouTube for videos
 */
async function searchYouTube(query: string, limit: number): Promise<ContentItem[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  // Search videos
  const searchResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: limit.toString(),
        key: YOUTUBE_API_KEY,
      })
  );

  if (!searchResponse.ok) {
    throw new Error(`YouTube search failed: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  const videoIds = searchData.items
    ?.map((item: { id: { videoId: string } }) => item.id.videoId)
    .join(',');

  if (!videoIds) {
    return [];
  }

  // Get video details for duration
  const detailsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?` +
      new URLSearchParams({
        part: 'contentDetails,statistics',
        id: videoIds,
        key: YOUTUBE_API_KEY,
      })
  );

  const detailsData = detailsResponse.ok ? await detailsResponse.json() : { items: [] };
  const durationMap = new Map<string, number>();
  const statsMap = new Map<string, { views: number; likes: number }>();

  for (const item of detailsData.items ?? []) {
    durationMap.set(item.id, parseDuration(item.contentDetails.duration));
    statsMap.set(item.id, {
      views: parseInt(item.statistics?.viewCount ?? '0', 10),
      likes: parseInt(item.statistics?.likeCount ?? '0', 10),
    });
  }

  const results: ContentItem[] = [];

  for (const item of searchData.items ?? []) {
    const videoId = item.id.videoId;
    results.push({
      id: `youtube-${videoId}`,
      source: 'youtube',
      type: 'video',
      title: item.snippet.title,
      subtitle: item.snippet.channelTitle,
      thumbnailUrl:
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.default?.url,
      duration: durationMap.get(videoId) ?? 0,
      playbackUrl: `https://www.youtube.com/watch?v=${videoId}`,
      deepLinkUrl: `https://www.youtube.com/watch?v=${videoId}`,
      sourceMetadata: {
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description,
        views: statsMap.get(videoId)?.views ?? 0,
        likes: statsMap.get(videoId)?.likes ?? 0,
      },
    });
  }

  return results;
}

/**
 * Parse ISO 8601 duration to milliseconds
 */
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

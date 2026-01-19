import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

/**
 * Image Proxy API
 *
 * Proxies external images to avoid CORS issues when using ColorThief
 * for color extraction from album art and thumbnails.
 *
 * Usage: /api/image-proxy?url=https://example.com/image.jpg
 */

// Cache duration in seconds (1 hour)
const CACHE_DURATION = 3600;

// Allowed image hosts (whitelist for security)
const ALLOWED_HOSTS = [
  'i.scdn.co', // Spotify
  'mosaic.scdn.co', // Spotify mosaics
  'i.ytimg.com', // YouTube
  'yt3.ggpht.com', // YouTube channels
  'img.youtube.com', // YouTube
  'occ-0-', // Netflix (CDN varies)
  'm.media-amazon.com', // Prime Video
  'images-na.ssl-images-amazon.com', // Amazon
  'image.tmdb.org', // TMDb
  'scontent', // Instagram CDN
  'cdninstagram.com', // Instagram
  'platform-lookaside.fbsbx.com', // Facebook
];

export async function GET(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(imageUrl);

    // Security: Check if host is allowed
    const isAllowed = ALLOWED_HOSTS.some((host) =>
      parsedUrl.hostname.includes(host)
    );

    if (!isAllowed) {
      // For development, allow all hosts but log warning
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Image proxy: Allowing non-whitelisted host', { hostname: parsedUrl.hostname });
      } else {
        return NextResponse.json(
          { error: 'Host not allowed' },
          { status: 403 }
        );
      }
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Q8-ContentHub/1.0',
        Accept: 'image/*',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');

    // Validate content type is an image
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json(
        { error: 'URL does not point to an image' },
        { status: 400 }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error('Image proxy error', { error: error });
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

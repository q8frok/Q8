# ContentHub Widget - Enhanced Implementation Plan

## Executive Summary

Transform the current SpotifyWidget into a comprehensive **ContentHubWidget** that aggregates music, video, and social content into a unified, personalized feed. This plan incorporates research on available APIs, tech stack recommendations, and all enhanced features.

---

## 1. API & Service Feasibility Analysis

### Tier 1: Full Integration (Native APIs Available)

| Service | API | Auth | Capabilities |
|---------|-----|------|--------------|
| **Spotify** | Web Playback SDK + Web API | OAuth 2.0 | Full playback control, streaming, playlists |
| **YouTube** | Data API v3 + IFrame API | API Key + OAuth | Search, playlists, embedded playback |
| **Podcasts** | RSS + iTunes Lookup | None/API Key | Universal podcast aggregation |

### Tier 2: Apify Scrapers (Metadata + Deeplinks)

| Service | Apify Actor | Pricing | Capabilities |
|---------|-------------|---------|--------------|
| **Netflix** | [Netflix Search Scraper](https://apify.com/easyapi/netflix-search-scraper) | $19.99/mo + usage | Titles, ratings, availability, IMDB data, deeplinks |
| **Netflix Trending** | [Netflix Top 10 Finder](https://apify.com/alien_force/netflix-top-10-finder) | Pay per result | Global/regional top 10, views, watch hours |
| **Prime Video** | Streaming Availability API | Pay per result | Multi-platform availability lookup |
| **Disney+** | Streaming Availability API | Pay per result | Multi-platform availability lookup |
| **Instagram Reels** | [Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper) | ~$2.60/1k results | Reels data, thumbnails, engagement, video URLs |
| **Facebook Reels** | Meta oEmbed Read | Free (requires app) | Public video embeds |

### Tier 3: Fallback APIs

| Service | API | Use Case |
|---------|-----|----------|
| **Watchmode** | [Watchmode API](https://api.watchmode.com/) | Streaming availability across 200+ services |
| **TMDb** | TMDb API | Movie/TV metadata, posters, ratings |
| **iTunes Lookup** | iTunes API | Podcast discovery, RSS feed URLs |

### Recommended Primary Stack

```
Primary Playback:    Spotify (audio) + YouTube (video)
Streaming Discovery: Apify Netflix Scraper + Watchmode fallback
Social Content:      Apify Instagram Reel Scraper + Meta oEmbed
Podcasts:            iTunes Lookup API + RSS parsing
```

---

## 2. Tech Stack Recommendations

### Frontend Dependencies

```json
{
  "dependencies": {
    "react-player": "^3.0.0",
    "react-youtube": "^10.x",
    "react-spotify-web-playback": "^0.14.x",
    "colorthief": "^2.4.0",
    "framer-motion": "^11.x",
    "@tanstack/react-virtual": "^3.x",
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",
    "date-fns": "^4.x",
    "rss-parser": "^3.x",
    "apify-client": "^2.x"
  }
}
```

### Backend API Structure

```
apps/web/src/app/api/
├── contenthub/
│   ├── route.ts                 # Unified content feed endpoint
│   ├── spotify/
│   │   └── route.ts             # Enhanced Spotify (existing, extend)
│   ├── youtube/
│   │   └── route.ts             # YouTube Data API v3
│   ├── apify/
│   │   ├── netflix/
│   │   │   └── route.ts         # Netflix Search Scraper
│   │   ├── instagram/
│   │   │   └── route.ts         # Instagram Reel Scraper
│   │   └── streaming/
│   │       └── route.ts         # Multi-platform availability
│   ├── podcasts/
│   │   └── route.ts             # iTunes + RSS aggregation
│   └── watchmode/
│       └── route.ts             # Watchmode fallback API
```

### MCP Server Extensions

```
apps/mcp-servers/
├── contenthub/
│   ├── youtube.ts               # YouTube search & recommendations
│   ├── apify.ts                 # Apify actor orchestration
│   ├── netflix.ts               # Netflix content discovery
│   └── podcast.ts               # Podcast discovery
```

---

## 3. Apify Integration Architecture

### Apify Client Setup

```typescript
// apps/web/src/lib/apify/client.ts

import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN!,
});

export { apifyClient };
```

### Netflix Scraper Integration

```typescript
// apps/web/src/app/api/contenthub/apify/netflix/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { apifyClient } from '@/lib/apify/client';

const NETFLIX_SEARCH_ACTOR = 'easyapi/netflix-search-scraper';
const NETFLIX_TOP10_ACTOR = 'alien_force/netflix-top-10-finder';

interface NetflixTitle {
  title: string;
  netflixId: string;
  synopsis: string;
  rating: number;
  releaseYear: number;
  runtime: number;
  coverUrl: string;
  imdbId: string;
  genres: string[];
  availability: string[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') ?? 'trending';

  try {
    if (query) {
      // Search Netflix catalog
      const run = await apifyClient.actor(NETFLIX_SEARCH_ACTOR).call({
        keywords: query,
        maxItems: 20,
      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      return NextResponse.json(normalizeNetflixResults(items as NetflixTitle[]));
    }

    // Get trending/top 10
    const run = await apifyClient.actor(NETFLIX_TOP10_ACTOR).call({
      countries: ['US'],
      type: 'movie', // or 'series'
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return NextResponse.json(normalizeNetflixResults(items as NetflixTitle[]));

  } catch (error) {
    console.error('Apify Netflix error:', error);
    return NextResponse.json({ error: 'Failed to fetch Netflix content' }, { status: 500 });
  }
}

function normalizeNetflixResults(items: NetflixTitle[]): ContentItem[] {
  return items.map(item => ({
    id: `netflix-${item.netflixId}`,
    source: 'netflix' as const,
    type: 'movie' as const,
    title: item.title,
    subtitle: `${item.releaseYear} • ${item.genres?.slice(0, 2).join(', ') ?? ''}`,
    thumbnailUrl: item.coverUrl,
    duration: (item.runtime ?? 0) * 60 * 1000,
    deepLinkUrl: `https://www.netflix.com/title/${item.netflixId}`,
    sourceMetadata: {
      netflixId: item.netflixId,
      imdbId: item.imdbId,
      rating: item.rating,
      synopsis: item.synopsis,
      availability: item.availability,
    }
  }));
}
```

### Instagram Reel Scraper Integration

```typescript
// apps/web/src/app/api/contenthub/apify/instagram/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { apifyClient } from '@/lib/apify/client';

const INSTAGRAM_REEL_ACTOR = 'apify/instagram-reel-scraper';
const INSTAGRAM_HASHTAG_ACTOR = 'apify/instagram-hashtag-scraper';

interface InstagramReel {
  id: string;
  shortCode: string;
  caption: string;
  timestamp: string;
  ownerUsername: string;
  ownerFullName: string;
  thumbnailUrl: string;
  videoUrl: string;
  viewCount: number;
  likeCount: number;
  duration: number;
  hashtags: string[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hashtag = searchParams.get('hashtag');
  const profileUrl = searchParams.get('profile');

  try {
    if (hashtag) {
      // Get reels by hashtag
      const run = await apifyClient.actor(INSTAGRAM_HASHTAG_ACTOR).call({
        hashtags: [hashtag],
        resultsType: 'reels',
        resultsLimit: 20,
      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      return NextResponse.json(normalizeInstagramReels(items as InstagramReel[]));
    }

    if (profileUrl) {
      // Get reels from specific profile
      const run = await apifyClient.actor(INSTAGRAM_REEL_ACTOR).call({
        directUrls: [profileUrl],
        resultsLimit: 20,
      });

      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      return NextResponse.json(normalizeInstagramReels(items as InstagramReel[]));
    }

    // Default: trending reels (using popular hashtags)
    const run = await apifyClient.actor(INSTAGRAM_HASHTAG_ACTOR).call({
      hashtags: ['trending', 'viral', 'explore'],
      resultsType: 'reels',
      resultsLimit: 30,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return NextResponse.json(normalizeInstagramReels(items as InstagramReel[]));

  } catch (error) {
    console.error('Apify Instagram error:', error);
    return NextResponse.json({ error: 'Failed to fetch Instagram reels' }, { status: 500 });
  }
}

function normalizeInstagramReels(items: InstagramReel[]): ContentItem[] {
  return items.map(item => ({
    id: `instagram-${item.id}`,
    source: 'instagram' as const,
    type: 'reel' as const,
    title: item.caption?.slice(0, 100) ?? 'Instagram Reel',
    subtitle: `@${item.ownerUsername}`,
    thumbnailUrl: item.thumbnailUrl,
    duration: (item.duration ?? 30) * 1000,
    playbackUrl: item.videoUrl,
    deepLinkUrl: `https://www.instagram.com/reel/${item.shortCode}`,
    sourceMetadata: {
      shortCode: item.shortCode,
      viewCount: item.viewCount,
      likeCount: item.likeCount,
      hashtags: item.hashtags,
      ownerUsername: item.ownerUsername,
    }
  }));
}
```

### Apify Rate Limiting & Caching

```typescript
// apps/web/src/lib/apify/cache.ts

import { unstable_cache } from 'next/cache';
import { apifyClient } from './client';

// Cache Apify results for 1 hour to minimize API costs
export const getCachedNetflixTrending = unstable_cache(
  async () => {
    const run = await apifyClient.actor('alien_force/netflix-top-10-finder').call({
      countries: ['US'],
    });
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return items;
  },
  ['netflix-trending'],
  { revalidate: 3600 } // 1 hour cache
);

export const getCachedInstagramTrending = unstable_cache(
  async (hashtags: string[]) => {
    const run = await apifyClient.actor('apify/instagram-hashtag-scraper').call({
      hashtags,
      resultsType: 'reels',
      resultsLimit: 30,
    });
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return items;
  },
  ['instagram-trending'],
  { revalidate: 1800 } // 30 min cache
);
```

---

## 4. Data Architecture

### Unified Content Schema

```typescript
// packages/types/contenthub.ts

type ContentSource =
  | 'spotify'
  | 'youtube'
  | 'netflix'
  | 'primevideo'
  | 'disney'
  | 'instagram'
  | 'facebook'
  | 'podcast';

type ContentType =
  | 'track'
  | 'video'
  | 'movie'
  | 'tvshow'
  | 'reel'
  | 'podcast_episode';

interface ContentItem {
  id: string;
  source: ContentSource;
  type: ContentType;

  // Universal metadata
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  duration: number; // Milliseconds

  // Playback
  playbackUrl?: string;       // Direct playback (Spotify, YouTube, Instagram)
  deepLinkUrl?: string;       // Native app redirect (Netflix, etc.)
  embedHtml?: string;         // oEmbed HTML (Facebook)

  // Source-specific
  sourceMetadata: Record<string, unknown>;

  // User context
  progress?: number;
  addedAt?: Date;
  lastPlayedAt?: Date;
}

interface ContentQueue {
  nowPlaying: ContentItem | null;
  upNext: ContentItem[];
  history: ContentItem[];
  savedForLater: ContentItem[];
}

interface ContentPreferences {
  activeMode: 'focus' | 'break' | 'discover' | 'workout' | 'sleep' | 'custom';
  excludedSources: ContentSource[];
  preferredCategories: string[];
}
```

### RxDB Schema Extension

```typescript
// apps/web/src/lib/db/schemas/contenthub.ts

export const contentQueueSchema = {
  title: 'contentqueue',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          contentId: { type: 'string' },
          source: { type: 'string' },
          position: { type: 'number' },
          addedAt: { type: 'number' }
        }
      }
    },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'items']
};

export const contentHistorySchema = {
  title: 'contenthistory',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    contentId: { type: 'string' },
    source: { type: 'string' },
    progress: { type: 'number' },
    duration: { type: 'number' },
    playedAt: { type: 'number' }
  },
  required: ['id', 'contentId', 'source']
};

export const sharedQueueSchema = {
  title: 'sharedqueue',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    ownerId: { type: 'string' },
    collaborators: { type: 'array', items: { type: 'string' } },
    items: { type: 'array' },
    playbackPosition: { type: 'number' },
    isPublic: { type: 'boolean' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'name', 'ownerId']
};
```

### Supabase Tables

```sql
-- infra/supabase/migrations/contenthub.sql

CREATE TABLE content_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  active_mode TEXT DEFAULT 'discover',
  excluded_sources TEXT[] DEFAULT '{}',
  preferred_categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saved_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id, source)
);

CREATE TABLE content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  source TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  duration INTEGER,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shared_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborators UUID[] DEFAULT '{}',
  items JSONB DEFAULT '[]',
  playback_position INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE content_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_queues ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own preferences"
  ON content_preferences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own saved content"
  ON saved_content FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own history"
  ON content_history FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public queues or their own"
  ON shared_queues FOR SELECT
  USING (is_public OR auth.uid() = owner_id OR auth.uid() = ANY(collaborators));

CREATE POLICY "Owners and collaborators can update queues"
  ON shared_queues FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = ANY(collaborators));
```

---

## 5. Frontend Architecture

### Component Hierarchy

```
ContentHubWidget/
├── index.tsx                    # Main widget with compact/expanded states
├── CompactView/
│   ├── NowPlayingCard.tsx       # Active content with mini controls
│   ├── UpNextQueue.tsx          # Horizontal scroll of upcoming items
│   └── QuickActions.tsx         # AI, Smart Home, Mode buttons
├── ExpandedView/
│   ├── MediaCommandCenter.tsx   # Full overlay controller
│   ├── UnifiedSearchBar.tsx     # Cross-platform search
│   ├── ContentGrid.tsx          # Netflix-style browsing
│   ├── CategorySidebar.tsx      # Filter by type/source
│   ├── EmbeddedPlayer.tsx       # Right-side player pane
│   ├── QueueManager.tsx         # Drag-drop queue management
│   ├── LyricsOverlay.tsx        # Synced lyrics/captions
│   └── CastDeviceSelector.tsx   # Smart Home device casting
├── Players/
│   ├── SpotifyPlayer.tsx        # Spotify Web Playback SDK
│   ├── YouTubePlayer.tsx        # react-youtube component
│   ├── InstagramPlayer.tsx      # Instagram video player
│   └── UniversalPlayer.tsx      # react-player for generic URLs
├── Features/
│   ├── AIDiscovery.tsx          # AI-powered recommendations
│   ├── ContinueWatching.tsx     # Cross-platform resume
│   ├── ModeSelector.tsx         # Focus/Break/Workout/Sleep modes
│   ├── PictureInPicture.tsx     # Floating mini player
│   ├── VoiceControl.tsx         # Voice command integration
│   ├── SharedQueue.tsx          # Collaborative playlists
│   └── LyricsCaptions.tsx       # Synced lyrics display
└── hooks/
    ├── useContentHub.ts         # Main state management
    ├── usePlayback.ts           # Unified playback controls
    ├── useColorTheme.ts         # Dynamic theming from artwork
    ├── useContentDiscovery.ts   # AI-powered recommendations
    ├── usePictureInPicture.ts   # PiP functionality
    ├── useVoiceCommands.ts      # Voice control
    ├── useCastMedia.ts          # Smart Home casting
    ├── useSharedQueue.ts        # Collaborative queues
    └── useSyncedLyrics.ts       # Lyrics/captions sync
```

### State Management with Zustand

```typescript
// apps/web/src/lib/stores/contenthub.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ContentMode = 'focus' | 'break' | 'discover' | 'workout' | 'sleep';

interface ContentHubState {
  // Playback state
  nowPlaying: ContentItem | null;
  isPlaying: boolean;
  progress: number;
  volume: number;

  // Queue
  queue: ContentItem[];
  history: ContentItem[];
  savedForLater: ContentItem[];

  // UI state
  isExpanded: boolean;
  activeMode: ContentMode;
  activeSource: ContentSource | 'all';
  showLyrics: boolean;
  isPiPActive: boolean;

  // Dynamic theme
  dominantColor: [number, number, number] | null;

  // Shared queue
  activeSharedQueue: string | null;

  // Actions
  play: (item: ContentItem) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (item: ContentItem) => void;
  removeFromQueue: (itemId: string) => void;
  saveForLater: (item: ContentItem) => void;
  setMode: (mode: ContentMode) => void;
  setDominantColor: (color: [number, number, number]) => void;
  toggleLyrics: () => void;
  toggleExpanded: () => void;
  setPiPActive: (active: boolean) => void;
  joinSharedQueue: (queueId: string) => void;
  leaveSharedQueue: () => void;
}

export const useContentHubStore = create<ContentHubState>()(
  persist(
    (set, get) => ({
      // Initial state
      nowPlaying: null,
      isPlaying: false,
      progress: 0,
      volume: 80,
      queue: [],
      history: [],
      savedForLater: [],
      isExpanded: false,
      activeMode: 'discover',
      activeSource: 'all',
      showLyrics: false,
      isPiPActive: false,
      dominantColor: null,
      activeSharedQueue: null,

      // Playback actions
      play: (item) => {
        const { nowPlaying, history } = get();
        set({
          nowPlaying: item,
          isPlaying: true,
          progress: 0,
          history: nowPlaying
            ? [nowPlaying, ...history.slice(0, 49)]
            : history
        });
      },

      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),

      next: () => {
        const { queue, nowPlaying, history } = get();
        if (queue.length > 0) {
          const [nextItem, ...restQueue] = queue;
          set({
            nowPlaying: nextItem,
            queue: restQueue,
            progress: 0,
            history: nowPlaying
              ? [nowPlaying, ...history.slice(0, 49)]
              : history
          });
        }
      },

      previous: () => {
        const { history, nowPlaying, queue } = get();
        if (history.length > 0) {
          const [prevItem, ...restHistory] = history;
          set({
            nowPlaying: prevItem,
            history: restHistory,
            progress: 0,
            queue: nowPlaying ? [nowPlaying, ...queue] : queue
          });
        }
      },

      seek: (position) => set({ progress: position }),
      setVolume: (volume) => set({ volume }),

      addToQueue: (item) => set(s => ({ queue: [...s.queue, item] })),
      removeFromQueue: (itemId) => set(s => ({
        queue: s.queue.filter(i => i.id !== itemId)
      })),

      saveForLater: (item) => set(s => ({
        savedForLater: [item, ...s.savedForLater.filter(i => i.id !== item.id)]
      })),

      setMode: (mode) => set({ activeMode: mode }),
      setDominantColor: (color) => set({ dominantColor: color }),
      toggleLyrics: () => set(s => ({ showLyrics: !s.showLyrics })),
      toggleExpanded: () => set(s => ({ isExpanded: !s.isExpanded })),
      setPiPActive: (active) => set({ isPiPActive: active }),

      joinSharedQueue: (queueId) => set({ activeSharedQueue: queueId }),
      leaveSharedQueue: () => set({ activeSharedQueue: null }),
    }),
    { name: 'contenthub-storage' }
  )
);
```

### Dynamic Color Theming Hook

```typescript
// apps/web/src/hooks/useColorTheme.ts

import { useEffect, useState } from 'react';
import ColorThief from 'colorthief';
import { useContentHubStore } from '@/lib/stores/contenthub';

export function useColorTheme(imageUrl: string | null) {
  const setDominantColor = useContentHubStore(s => s.setDominantColor);
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Proxy through Next.js API to avoid CORS
    img.src = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;

    img.onload = () => {
      const colorThief = new ColorThief();
      const dominant = colorThief.getColor(img);
      const palette = colorThief.getPalette(img, 3);

      setDominantColor(dominant);

      const [r, g, b] = dominant;
      const [r2, g2, b2] = palette[1] ?? dominant;

      setGradientStyle({
        background: `linear-gradient(135deg,
          rgba(${r}, ${g}, ${b}, 0.4) 0%,
          rgba(${r2}, ${g2}, ${b2}, 0.2) 50%,
          transparent 100%)`
      });
    };
  }, [imageUrl, setDominantColor]);

  return { gradientStyle };
}
```

---

## 6. Enhanced Features (All Included)

### Feature 1: AI-Powered Content Discovery

```typescript
// apps/web/src/hooks/useContentDiscovery.ts

import { useCallback } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';

interface DiscoveryContext {
  mood: 'focus' | 'relaxed' | 'energetic' | 'curious';
  duration: 'quick' | 'medium' | 'long';
  contentTypes?: ContentType[];
  excludeSources?: ContentSource[];
}

export function useContentDiscovery() {
  const { history, activeMode } = useContentHubStore();

  const discoverContent = useCallback(async (context: DiscoveryContext) => {
    const response = await fetch('/api/contenthub/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...context,
        recentHistory: history.slice(0, 10).map(h => ({
          source: h.source,
          type: h.type,
          title: h.title
        })),
        currentMode: activeMode
      })
    });

    return response.json();
  }, [history, activeMode]);

  const getSmartSuggestions = useCallback(async () => {
    const hour = new Date().getHours();
    const mood = hour < 12 ? 'energetic' : hour < 18 ? 'focus' : 'relaxed';

    return discoverContent({
      mood,
      duration: activeMode === 'focus' ? 'long' : 'medium',
    });
  }, [discoverContent, activeMode]);

  return { discoverContent, getSmartSuggestions };
}

// MCP tool for AI agent integration
export const contentDiscoveryTool = {
  name: 'discover_content',
  description: 'Get AI-powered content recommendations based on user context and preferences',
  parameters: {
    type: 'object',
    properties: {
      mood: { type: 'string', enum: ['focus', 'relaxed', 'energetic', 'curious'] },
      duration: { type: 'string', enum: ['quick', 'medium', 'long'] },
      contentType: { type: 'array', items: { type: 'string' } }
    }
  }
};
```

### Feature 2: Cross-Platform Continue Watching

```typescript
// apps/web/src/hooks/useContinueWatching.ts

import { useEffect, useState } from 'react';
import { useRxData } from 'rxdb-hooks';
import { formatDuration } from 'date-fns';

interface ContinueWatchingItem extends ContentItem {
  resumeLabel: string;
  percentComplete: number;
}

export function useContinueWatching() {
  const { result: historyDocs } = useRxData('content_history',
    q => q.find()
      .where('progress').gt(0)
      .where('progress').lt(95) // Not yet completed
      .sort({ playedAt: 'desc' })
      .limit(10)
  );

  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  useEffect(() => {
    if (!historyDocs) return;

    const items = historyDocs.map(doc => {
      const data = doc.toJSON();
      const remaining = data.duration - data.progress;
      const percentComplete = Math.round((data.progress / data.duration) * 100);

      return {
        ...data,
        resumeLabel: `${formatDuration({ seconds: Math.floor(remaining / 1000) })} left`,
        percentComplete
      };
    });

    setContinueWatching(items);
  }, [historyDocs]);

  return { continueWatching };
}
```

### Feature 3: Smart Playlists / Mix Modes

```typescript
// apps/web/src/lib/contenthub/modes.ts

export const PRESET_MODES = {
  focus: {
    name: 'Focus Mode',
    icon: 'Brain',
    description: 'Long-form instrumental and educational content',
    filter: {
      excludeTypes: ['reel'],
      minDuration: 180000, // 3+ minutes
      preferCategories: ['instrumental', 'ambient', 'tutorial', 'documentary'],
      excludeSources: ['instagram', 'facebook']
    }
  },
  break: {
    name: 'Break Mode',
    icon: 'Coffee',
    description: 'Quick entertainment and trending content',
    filter: {
      maxDuration: 600000, // < 10 minutes
      preferCategories: ['comedy', 'music', 'trending', 'viral']
    }
  },
  workout: {
    name: 'Workout Mode',
    icon: 'Dumbbell',
    description: 'High-energy music and fitness videos',
    filter: {
      preferCategories: ['workout', 'high-energy', 'electronic', 'hip-hop'],
      bpmRange: [120, 160],
      preferSources: ['spotify', 'youtube']
    }
  },
  sleep: {
    name: 'Sleep Mode',
    icon: 'Moon',
    description: 'Calming ambient and meditation content',
    filter: {
      preferCategories: ['ambient', 'nature', 'asmr', 'meditation', 'sleep'],
      maxVolume: 50,
      autoFade: true
    }
  },
  discover: {
    name: 'Discover Mode',
    icon: 'Compass',
    description: 'Explore new content across all sources',
    filter: {
      // No restrictions, show everything
    }
  }
} as const;

export type ContentMode = keyof typeof PRESET_MODES;
```

### Feature 4: Picture-in-Picture Mode

```typescript
// apps/web/src/hooks/usePictureInPicture.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';

export function usePictureInPicture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { setPiPActive, isPiPActive } = useContentHubStore();

  const enterPiP = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!document.pictureInPictureEnabled) {
      console.warn('PiP not supported');
      return false;
    }

    try {
      videoRef.current = videoElement;
      await videoElement.requestPictureInPicture();
      setPiPActive(true);
      return true;
    } catch (error) {
      console.error('Failed to enter PiP:', error);
      return false;
    }
  }, [setPiPActive]);

  const exitPiP = useCallback(async () => {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
        setPiPActive(false);
        return true;
      } catch (error) {
        console.error('Failed to exit PiP:', error);
        return false;
      }
    }
    return false;
  }, [setPiPActive]);

  const togglePiP = useCallback(async () => {
    if (isPiPActive) {
      return exitPiP();
    } else if (videoRef.current) {
      return enterPiP(videoRef.current);
    }
    return false;
  }, [isPiPActive, enterPiP, exitPiP]);

  // Handle PiP events
  useEffect(() => {
    const handlePiPChange = () => {
      setPiPActive(!!document.pictureInPictureElement);
    };

    document.addEventListener('enterpictureinpicture', handlePiPChange);
    document.addEventListener('leavepictureinpicture', handlePiPChange);

    return () => {
      document.removeEventListener('enterpictureinpicture', handlePiPChange);
      document.removeEventListener('leavepictureinpicture', handlePiPChange);
    };
  }, [setPiPActive]);

  return { isPiPActive, enterPiP, exitPiP, togglePiP, videoRef };
}
```

### Feature 5: Voice Control Integration

```typescript
// apps/web/src/hooks/useVoiceCommands.ts

import { useCallback, useEffect } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';
import { useContentDiscovery } from './useContentDiscovery';

const VOICE_COMMAND_MAP: Record<string, () => void | Promise<void>> = {};

export function useVoiceCommands() {
  const store = useContentHubStore();
  const { discoverContent } = useContentDiscovery();

  // Register voice commands
  useEffect(() => {
    Object.assign(VOICE_COMMAND_MAP, {
      'play': () => store.resume(),
      'pause': () => store.pause(),
      'stop': () => store.pause(),
      'next': () => store.next(),
      'skip': () => store.next(),
      'previous': () => store.previous(),
      'back': () => store.previous(),
      'focus mode': () => store.setMode('focus'),
      'break mode': () => store.setMode('break'),
      'workout mode': () => store.setMode('workout'),
      'sleep mode': () => store.setMode('sleep'),
      'show lyrics': () => store.toggleLyrics(),
      'hide lyrics': () => store.toggleLyrics(),
      'play something relaxing': async () => {
        const content = await discoverContent({ mood: 'relaxed', duration: 'medium' });
        if (content.feed?.[0]) store.play(content.feed[0]);
      },
      'play something energetic': async () => {
        const content = await discoverContent({ mood: 'energetic', duration: 'medium' });
        if (content.feed?.[0]) store.play(content.feed[0]);
      },
    });
  }, [store, discoverContent]);

  const executeVoiceCommand = useCallback((transcript: string) => {
    const normalizedTranscript = transcript.toLowerCase().trim();

    for (const [command, handler] of Object.entries(VOICE_COMMAND_MAP)) {
      if (normalizedTranscript.includes(command)) {
        handler();
        return true;
      }
    }

    return false;
  }, []);

  return { executeVoiceCommand, availableCommands: Object.keys(VOICE_COMMAND_MAP) };
}
```

### Feature 6: Smart Home Media Control

```typescript
// apps/web/src/hooks/useCastMedia.ts

import { useState, useCallback, useEffect } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';

interface MediaDevice {
  entityId: string;
  name: string;
  type: 'tv' | 'speaker' | 'chromecast' | 'sonos';
  capabilities: ('video' | 'audio')[];
  isActive: boolean;
}

export function useCastMedia() {
  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<MediaDevice | null>(null);
  const { nowPlaying } = useContentHubStore();

  // Fetch available devices from Home Assistant
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/home-assistant/devices?type=media_player');
        const data = await response.json();
        setDevices(data.devices ?? []);
      } catch (error) {
        console.error('Failed to fetch media devices:', error);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const castToDevice = useCallback(async (content: ContentItem, device: MediaDevice) => {
    try {
      await fetch('/api/home-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'media_player.play_media',
          entity_id: device.entityId,
          media_content_id: content.playbackUrl ?? content.deepLinkUrl,
          media_content_type: content.type === 'track' ? 'audio' : 'video'
        })
      });
      setActiveDevice(device);
      return true;
    } catch (error) {
      console.error('Failed to cast to device:', error);
      return false;
    }
  }, []);

  const stopCasting = useCallback(async () => {
    if (!activeDevice) return false;

    try {
      await fetch('/api/home-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'media_player.media_stop',
          entity_id: activeDevice.entityId
        })
      });
      setActiveDevice(null);
      return true;
    } catch (error) {
      console.error('Failed to stop casting:', error);
      return false;
    }
  }, [activeDevice]);

  return { devices, activeDevice, castToDevice, stopCasting };
}
```

### Feature 7: Content Sharing Queue

```typescript
// apps/web/src/hooks/useSharedQueue.ts

import { useEffect, useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useContentHubStore } from '@/lib/stores/contenthub';

interface SharedQueue {
  id: string;
  name: string;
  ownerId: string;
  collaborators: string[];
  items: ContentItem[];
  playbackPosition: number;
  isPublic: boolean;
}

export function useSharedQueue(queueId?: string) {
  const [sharedQueue, setSharedQueue] = useState<SharedQueue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { joinSharedQueue, leaveSharedQueue } = useContentHubStore();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Subscribe to real-time updates
  useEffect(() => {
    if (!queueId) return;

    setIsLoading(true);

    // Fetch initial queue
    const fetchQueue = async () => {
      const { data, error } = await supabase
        .from('shared_queues')
        .select('*')
        .eq('id', queueId)
        .single();

      if (data && !error) {
        setSharedQueue(data);
        joinSharedQueue(queueId);
      }
      setIsLoading(false);
    };

    fetchQueue();

    // Subscribe to changes
    const channel = supabase
      .channel(`queue:${queueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shared_queues',
        filter: `id=eq.${queueId}`
      }, (payload) => {
        setSharedQueue(payload.new as SharedQueue);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      leaveSharedQueue();
    };
  }, [queueId, joinSharedQueue, leaveSharedQueue, supabase]);

  const addToSharedQueue = useCallback(async (item: ContentItem) => {
    if (!sharedQueue) return false;

    const { error } = await supabase
      .from('shared_queues')
      .update({
        items: [...sharedQueue.items, item],
        updated_at: new Date().toISOString()
      })
      .eq('id', sharedQueue.id);

    return !error;
  }, [sharedQueue, supabase]);

  const createSharedQueue = useCallback(async (name: string, isPublic = false) => {
    const { data, error } = await supabase
      .from('shared_queues')
      .insert({
        name,
        is_public: isPublic,
        items: [],
        playback_position: 0
      })
      .select()
      .single();

    if (data && !error) {
      setSharedQueue(data);
      joinSharedQueue(data.id);
      return data;
    }
    return null;
  }, [supabase, joinSharedQueue]);

  return {
    sharedQueue,
    isLoading,
    addToSharedQueue,
    createSharedQueue
  };
}
```

### Feature 8: Lyrics & Closed Captions Overlay

```typescript
// apps/web/src/hooks/useSyncedLyrics.ts

import { useEffect, useState, useMemo } from 'react';
import { useContentHubStore } from '@/lib/stores/contenthub';

interface LyricsLine {
  startTime: number;
  endTime: number;
  text: string;
}

interface LyricsData {
  lines: LyricsLine[];
  provider: string;
  isInstrumental: boolean;
}

export function useSyncedLyrics() {
  const { nowPlaying, progress, showLyrics } = useContentHubStore();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!nowPlaying || nowPlaying.source !== 'spotify') {
      setLyricsData(null);
      return;
    }

    const fetchLyrics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/lyrics?trackId=${nowPlaying.sourceMetadata?.spotifyId}`
        );
        const data = await response.json();
        setLyricsData(data);
      } catch (error) {
        console.error('Failed to fetch lyrics:', error);
        setLyricsData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLyrics();
  }, [nowPlaying]);

  // Find current line based on progress
  const currentLine = useMemo(() => {
    if (!lyricsData?.lines || !showLyrics) return null;

    return lyricsData.lines.find(
      line => progress >= line.startTime && progress < line.endTime
    ) ?? null;
  }, [lyricsData, progress, showLyrics]);

  // Get upcoming lines for display
  const upcomingLines = useMemo(() => {
    if (!lyricsData?.lines || !showLyrics) return [];

    const currentIndex = lyricsData.lines.findIndex(
      line => progress >= line.startTime && progress < line.endTime
    );

    return lyricsData.lines.slice(
      Math.max(0, currentIndex - 1),
      currentIndex + 4
    );
  }, [lyricsData, progress, showLyrics]);

  return {
    lyricsData,
    currentLine,
    upcomingLines,
    isLoading,
    isInstrumental: lyricsData?.isInstrumental ?? false
  };
}
```

---

## 7. Implementation Phases (Updated with All Features)

### Phase 1: Foundation (Week 1-2)
- [ ] Create `ContentHubWidget` component structure
- [ ] Implement `useContentHubStore` Zustand store with all state
- [ ] Build `NowPlayingCard` with dynamic color theming (Color Thief)
- [ ] Set up `/api/contenthub/` route structure
- [ ] Extend existing Spotify API with enhanced features
- [ ] Create image proxy API for CORS handling

### Phase 2: Multi-Source Integration (Week 3-4)
- [ ] Implement YouTube Data API integration
- [ ] Set up Apify client and caching layer
- [ ] Add Apify Netflix Scraper integration
- [ ] Add Apify Instagram Reel Scraper integration
- [ ] Add Watchmode API as fallback
- [ ] Create unified content normalization layer
- [ ] Build `UpNextQueue` horizontal scroll component

### Phase 3: Mode System & Discovery (Week 5-6)
- [ ] Implement `ModeSelector` component (Focus/Break/Workout/Sleep/Discover)
- [ ] Build mode filtering logic in API routes
- [ ] Create `AIDiscovery` component and hook
- [ ] Implement AI content discovery MCP tool
- [ ] Build `ContinueWatching` component with progress tracking
- [ ] Add cross-platform progress sync to RxDB/Supabase

### Phase 4: Expanded View (Week 7-8)
- [ ] Build `MediaCommandCenter` overlay
- [ ] Implement `UnifiedSearchBar` with multi-source search
- [ ] Create `ContentGrid` Netflix-style browser
- [ ] Add `CategorySidebar` filtering
- [ ] Add `EmbeddedPlayer` split-pane view
- [ ] Implement smart handoff between sources (pause Spotify when YouTube plays)

### Phase 5: Advanced Playback Features (Week 9-10)
- [ ] Implement `PictureInPicture` component and hook
- [ ] Build `LyricsOverlay` with synced lyrics (Musixmatch API)
- [ ] Add `VoiceControl` integration with existing WebRTC system
- [ ] Create voice command parser and executor
- [ ] Add keyboard shortcuts for playback control

### Phase 6: Smart Home & Collaboration (Week 11-12)
- [ ] Implement `CastDeviceSelector` for Home Assistant integration
- [ ] Build `useCastMedia` hook with device discovery
- [ ] Create `SharedQueue` component with real-time sync
- [ ] Implement Supabase Realtime for collaborative queues
- [ ] Add queue sharing and collaboration features

### Phase 7: Polish & Optimization (Week 13-14)
- [ ] Performance optimization (virtualization, lazy loading)
- [ ] Offline support via RxDB caching
- [ ] Accessibility improvements (keyboard nav, screen readers, ARIA)
- [ ] Animation refinements with Framer Motion
- [ ] Cross-browser testing
- [ ] Mobile responsiveness optimization
- [ ] Apify cost optimization (caching, rate limiting)

---

## 8. Environment Variables

### Currently Available (from your .env.local)

```bash
# Already configured
SPOTIFY_CLIENT_ID=95baf8a9bd6c4c3eb39fb6160d7c1df2   # ✓
SPOTIFY_CLIENT_SECRET=db4945d8d13f40b8a17cadb8e4d2285f # ✓
GOOGLE_CLIENT_ID=...                                  # ✓
GOOGLE_CLIENT_SECRET=...                              # ✓
HASS_TOKEN=...                                        # ✓ (for Smart Home)
HASS_URL=...                                          # ✓ (for Smart Home)
```

### Additional Secrets Needed

```bash
# Spotify (REQUIRED - for Web Playback SDK persistent auth)
SPOTIFY_REFRESH_TOKEN=""        # Get from OAuth flow, required for playback

# YouTube (REQUIRED)
YOUTUBE_API_KEY=""              # Get from Google Cloud Console

# Apify (REQUIRED for Netflix/Instagram scraping)
APIFY_API_TOKEN=""              # Get from apify.com/account#integrations

# Watchmode (OPTIONAL - fallback for streaming metadata)
WATCHMODE_API_KEY=""            # Get from api.watchmode.com

# Lyrics (OPTIONAL - for synced lyrics feature)
MUSIXMATCH_API_KEY=""           # Get from developer.musixmatch.com

# Meta oEmbed (OPTIONAL - for Facebook Reels embeds)
META_APP_ID=""                  # Get from developers.facebook.com
META_APP_SECRET=""

# iTunes (OPTIONAL - for podcast affiliate links)
ITUNES_AFFILIATE_TOKEN=""       # Get from affiliate.itunes.apple.com
```

### Where to Get Each Key

| Secret | URL | Notes |
|--------|-----|-------|
| `SPOTIFY_REFRESH_TOKEN` | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) | Run OAuth flow once to get token |
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Enable YouTube Data API v3 |
| `APIFY_API_TOKEN` | [Apify Console](https://console.apify.com/account#integrations) | Free tier: $5/month credits |
| `WATCHMODE_API_KEY` | [Watchmode](https://api.watchmode.com/) | Free tier: 1,000 API calls/month |
| `MUSIXMATCH_API_KEY` | [Musixmatch Developer](https://developer.musixmatch.com/) | Free tier available |

---

## 9. Cost Estimates

### Apify Usage (Monthly)

| Actor | Estimated Usage | Cost |
|-------|-----------------|------|
| Netflix Search Scraper | ~500 runs | ~$25/month |
| Netflix Top 10 | ~60 runs (2x/day cache) | ~$5/month |
| Instagram Reel Scraper | ~1,000 results | ~$2.60/month |
| **Total Estimated** | | **~$35/month** |

### Optimization Strategies

1. **Aggressive Caching**: Cache Netflix trending for 1 hour, Instagram for 30 min
2. **On-Demand Only**: Only fetch when user explicitly browses Netflix/Instagram
3. **Watchmode Fallback**: Use free Watchmode tier for basic streaming availability
4. **Batch Requests**: Combine multiple searches into single Apify runs

---

## 10. Quality Gates

Before each phase completion:

```bash
# Type checking
pnpm turbo typecheck

# Build verification
pnpm turbo build --filter=@q8/web

# Unit tests
pnpm test -- run

# E2E tests (for UI changes)
pnpm playwright test --project=chromium
```

---

## 11. Risk Assessment & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube API quota limits | High | Cache aggressively, use IFrame player for embeds |
| Apify scraper changes | Medium | Abstract scraper logic, add Watchmode fallback |
| Netflix deeplinks breaking | Low | Validate links, add manual search fallback |
| Instagram content unavailable | Medium | Handle errors gracefully, show placeholder |
| Color extraction CORS | Medium | Proxy images through `/api/image-proxy` |
| Complex state management | High | Zustand + React Query separation of concerns |
| Mobile performance | Medium | Virtualization, lazy loading, PiP |
| Apify costs exceeding budget | Medium | Implement caching, rate limiting, free tier fallbacks |

---

## 12. Success Metrics

1. **Unified Experience**: Single widget controls 5+ content sources (Spotify, YouTube, Netflix, Instagram, Podcasts)
2. **Instant Feedback**: < 100ms UI response for all playback actions
3. **Smart Discovery**: AI correctly routes 90%+ of mood-based queries
4. **Cross-Platform Resume**: Progress syncs within 5 seconds
5. **Mode Effectiveness**: Focus mode filters 95%+ of short-form content
6. **Cast Success Rate**: 95%+ successful casts to Home Assistant devices
7. **Collaboration**: Shared queues sync within 1 second across devices
8. **Cost Efficiency**: Apify costs < $50/month with caching

---

## References

- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [Apify Netflix Search Scraper](https://apify.com/easyapi/netflix-search-scraper)
- [Apify Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper)
- [Watchmode API](https://api.watchmode.com/)
- [react-player v3](https://github.com/cookpete/react-player)
- [Color Thief](https://lokeshdhakar.com/projects/color-thief/)
- [Meta oEmbed Read](https://developers.facebook.com/docs/plugins/oembed)

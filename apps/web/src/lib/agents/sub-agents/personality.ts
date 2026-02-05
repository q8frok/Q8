/**
 * Personality Agent
 * Powered by Grok 4.1 (grok-4.1) via xAI API
 * Handles: Casual chat, creative writing, fun interactions
 * 
 * Enhanced capabilities (Jan 2026):
 * - Always-on reasoning for deeper conversations
 * - Live Search for real-time X/Twitter trends and news
 * - Image generation for creative visual outputs
 * - Vision analysis for image understanding
 */

import { getModel } from '../model_factory';
import type { Tool, OpenAITool } from '../types';

/**
 * Personality-specific tools (subset of default tools for context awareness)
 */
export const personalityTools: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_datetime',
      description: 'Get current date, time, and day of week',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., "America/New_York")',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'City name',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform calculations (math, percentages, conversions)',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Math expression to evaluate',
          },
        },
        required: ['expression'],
      },
    },
  },
];

/**
 * Spotify music control tools
 */
export const spotifyTools: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'spotify_search',
      description: 'Search for tracks, albums, artists, or playlists on Spotify',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "jazz music", "Beatles", "workout playlist")',
          },
          type: {
            type: 'string',
            enum: ['track', 'album', 'artist', 'playlist'],
            description: 'Type of content to search (default: track)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 10, max: 50)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotify_now_playing',
      description: 'Get the currently playing track and playback state on Spotify',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotify_play_pause',
      description: 'Control Spotify playback - play, pause, or toggle. Can also start playing a specific track/album/playlist',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['play', 'pause', 'toggle'],
            description: 'Action to perform (default: toggle)',
          },
          uri: {
            type: 'string',
            description: 'Spotify URI to play (e.g., spotify:track:..., spotify:album:..., spotify:playlist:...)',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotify_next_previous',
      description: 'Skip to the next or previous track on Spotify',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['next', 'previous'],
            description: 'Direction to skip',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID (optional)',
          },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotify_add_to_queue',
      description: 'Add a track to the Spotify playback queue',
      parameters: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Spotify track URI (e.g., spotify:track:...)',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID (optional)',
          },
        },
        required: ['uri'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotify_get_devices',
      description: 'List all available Spotify playback devices',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotify_set_volume',
      description: 'Set the Spotify playback volume',
      parameters: {
        type: 'object',
        properties: {
          volume: {
            type: 'number',
            description: 'Volume level (0-100)',
          },
          deviceId: {
            type: 'string',
            description: 'Target device ID (optional)',
          },
        },
        required: ['volume'],
      },
    },
  },
];

export const personalityAgentConfig = {
  name: 'PersonalityBot',
  model: getModel('personality'),
  instructions: `You are Q8, the fun and engaging personality powered by Grok 4.1 with always-on reasoning.

Your style:
- **Witty & Clever**: Use humor and wordplay naturally
- **Conversational**: Chat like a knowledgeable friend
- **Culturally Aware**: Reference current trends, memes, and pop culture from X/Twitter
- **Creative**: Excel at brainstorming, writing, ideation, and visual creation
- **Thoughtful**: Use your reasoning capabilities even for casual conversations
- **Helpful**: Despite the personality, always provide useful information

Capabilities:
- Casual conversation and banter with depth
- Creative writing (stories, poems, jokes, scripts)
- Image generation for fun visuals, memes, and illustrations
- Brainstorming and idea generation
- Real-time trends and news from X/Twitter via Live Search
- Fun facts and trivia
- General knowledge questions
- Light-hearted advice with thoughtful reasoning
- Image analysis and commentary
- **Music control via Spotify** - search, play, pause, skip, queue, volume

## IMPORTANT: Tool Usage for Music
You have access to Spotify tools for music control. **ALWAYS use these tools** when the user:
- Asks you to play music, a song, an artist, or playlist
- Asks what's currently playing
- Asks to pause, skip, or control playback
- Asks to search for music on Spotify
- Asks to adjust volume or add to queue

Available Spotify tools:
- spotify_search: Search for tracks, albums, artists, or playlists
- spotify_now_playing: Get current playback state
- spotify_play_pause: Play, pause, or toggle playback
- spotify_next_previous: Skip to next/previous track
- spotify_add_to_queue: Add a track to the queue
- spotify_get_devices: List available Spotify devices
- spotify_set_volume: Adjust volume

**DO NOT** just tell the user how to do it themselves. **USE THE TOOLS** to actually control Spotify.

Guidelines:
1. Be entertaining but not at the expense of being helpful
2. Match the user's energy and tone
3. Use context (time of day, weather, current events) to personalize responses
4. If asked something serious, dial back the humor appropriately
5. Never be offensive or inappropriate
6. When generating images, make them fun and creative
7. Reference current events and trends naturally when relevant
8. **For any music-related request, USE the Spotify tools - don't just respond conversationally**

You have awareness of the current time, date, weather, real-time trends, and can control music playback.
For example, you might comment on the weather, time of day, trending topics, or day of the week naturally in conversation.`,
  tools: [] as Tool[],
  openaiTools: [...personalityTools, ...spotifyTools],
};

export async function initializePersonalityAgent() {
  return {
    ...personalityAgentConfig,
  };
}

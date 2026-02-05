import { type ExtendedAgentType } from './types';
import { homeAssistantTools, executeHomeAssistantTool } from '../home-tools';
import { financeAdvisorConfig, executeFinanceAdvisorTool } from '../sub-agents/finance-advisor';
import { coderAgentConfig, executeCoderTool } from '../sub-agents/coder';
import { secretaryAgentConfig, executeGoogleTool } from '../sub-agents/secretary';
import { researcherAgentConfig } from '../sub-agents/researcher';
import { personalityAgentConfig } from '../sub-agents/personality';
import { executeDefaultTool, defaultTools } from '../tools/default-tools';
import { imageTools, executeImageTool } from '../tools';
import { knowledgeTools, executeKnowledgeTool } from '../tools/knowledge';
import {
  searchSpotify,
  getNowPlaying,
  controlPlayback,
  skipTrack,
  addToQueue,
  getDevices,
  setVolume,
} from '@/lib/mcp/tools/spotify';
import { logger } from '@/lib/logger';
import type { ToolResult } from '../types';
import { TOOL_TIMEOUTS, DEFAULT_TOOL_TIMEOUT, CONFIRMATION_REQUIRED_TOOLS } from './constants';

/**
 * List of Spotify tool names
 */
const SPOTIFY_TOOLS = [
  'spotify_search',
  'spotify_now_playing',
  'spotify_play_pause',
  'spotify_next_previous',
  'spotify_add_to_queue',
  'spotify_get_devices',
  'spotify_set_volume',
];

/**
 * Execute a Spotify tool
 */
async function executeSpotifyTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    let result: unknown;

    switch (toolName) {
      case 'spotify_search':
        result = await searchSpotify(
          args.query as string,
          args.type as 'track' | 'album' | 'artist' | 'playlist' | undefined,
          args.limit as number | undefined
        );
        break;

      case 'spotify_now_playing':
        result = await getNowPlaying();
        break;

      case 'spotify_play_pause':
        result = await controlPlayback(
          args.action as 'play' | 'pause' | 'toggle' | undefined,
          args.uri as string | undefined,
          args.deviceId as string | undefined
        );
        break;

      case 'spotify_next_previous':
        result = await skipTrack(
          args.direction as 'next' | 'previous',
          args.deviceId as string | undefined
        );
        break;

      case 'spotify_add_to_queue':
        result = await addToQueue(
          args.uri as string,
          args.deviceId as string | undefined
        );
        break;

      case 'spotify_get_devices':
        result = await getDevices();
        break;

      case 'spotify_set_volume':
        result = await setVolume(
          args.volume as number,
          args.deviceId as string | undefined
        );
        break;

      default:
        return {
          success: false,
          message: `Unknown Spotify tool: ${toolName}`,
        };
    }

    return {
      success: true,
      message: `Successfully executed ${toolName}`,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's an MCP connection error
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('not found in any registered server')) {
      return {
        success: false,
        message: `Spotify MCP server not available. Please ensure the MCP server is running at ${process.env.SPOTIFY_MCP_URL || 'http://localhost:3005'}.`,
        error: { code: 'CONNECTION_ERROR', details: errorMessage },
      };
    }

    return {
      success: false,
      message: `Failed to execute ${toolName}: ${errorMessage}`,
      error: { code: 'EXECUTION_ERROR', details: errorMessage },
    };
  }
}

/**
 * Get tools for an agent
 * Each agent has a specific set of tools available for function calling
 */
export function getAgentTools(agent: ExtendedAgentType): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  switch (agent) {
    case 'home':
      return homeAssistantTools;
    case 'finance':
      return financeAdvisorConfig.openaiTools;
    case 'coder':
      return coderAgentConfig.openaiTools;
    case 'secretary':
      return secretaryAgentConfig.openaiTools;
    case 'researcher':
      // Add knowledge tools to researcher for explicit RAG queries
      return [...researcherAgentConfig.openaiTools, ...knowledgeTools];
    case 'imagegen':
      return imageTools;
    case 'personality':
      return personalityAgentConfig.openaiTools;
    default:
      return defaultTools;
  }
}

/**
 * Check if a tool requires user confirmation
 */
export function requiresConfirmation(toolName: string, args: Record<string, unknown>): boolean {
  if (CONFIRMATION_REQUIRED_TOOLS.has(toolName)) {
    // Special case: SQL only needs confirmation for destructive operations
    if (toolName === 'supabase_run_sql') {
      const query = (args.query as string || '').toUpperCase();
      return /\b(DELETE|DROP|TRUNCATE|ALTER|UPDATE)\b/.test(query);
    }
    return true;
  }
  return false;
}

/**
 * Classify error type for better error handling
 */
function classifyError(error: unknown): { code: string; recoverable: boolean } {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('timed out')) {
    return { code: 'TIMEOUT', recoverable: true };
  }
  if (message.includes('Failed to fetch') || message.includes('ECONNREFUSED')) {
    return { code: 'CONNECTION_ERROR', recoverable: true };
  }
  if (message.includes('not found') || message.includes('404')) {
    return { code: 'NOT_FOUND', recoverable: false };
  }
  if (message.includes('Unauthorized') || message.includes('401') || message.includes('403')) {
    return { code: 'AUTH_ERROR', recoverable: false };
  }
  if (message.includes('rate limit') || message.includes('429')) {
    return { code: 'RATE_LIMITED', recoverable: true };
  }
  if (message.includes('Validation') || message.includes('Invalid')) {
    return { code: 'VALIDATION_ERROR', recoverable: false };
  }

  return { code: 'UNKNOWN_ERROR', recoverable: false };
}

/**
 * Execute a promise with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Tool '${toolName}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Execute a tool for an agent with timeout and error boundaries
 */
export async function executeAgentTool(
  agent: ExtendedAgentType,
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  const startTime = Date.now();
  const timeout = TOOL_TIMEOUTS[toolName] ?? DEFAULT_TOOL_TIMEOUT;
  const traceId = `${agent}-${toolName}-${Date.now()}`;

  logger.info('[ToolExecution] Starting', {
    agent,
    tool: toolName,
    traceId,
    timeout,
  });

  try {
    const executorPromise = (async (): Promise<ToolResult> => {
      switch (agent) {
        case 'home':
          return executeHomeAssistantTool(toolName, args);
        case 'finance':
          return executeFinanceAdvisorTool(toolName, args, userId);
        case 'coder':
          return executeCoderTool(toolName, args);
        case 'secretary':
          return executeGoogleTool(toolName, args);
        case 'imagegen':
          return executeImageTool(toolName, args);
        case 'researcher':
          // Handle knowledge tools for researcher
          if (['search_knowledge', 'list_documents'].includes(toolName)) {
            return executeKnowledgeTool(toolName, args, userId);
          }
          return executeDefaultTool(toolName, args);
        case 'personality':
          // Check if it's a Spotify tool
          if (SPOTIFY_TOOLS.includes(toolName)) {
            return executeSpotifyTool(toolName, args);
          }
          return executeDefaultTool(toolName, args);
        default:
          return executeDefaultTool(toolName, args);
      }
    })();

    const result = await withTimeout(executorPromise, timeout, toolName);
    const durationMs = Date.now() - startTime;

    logger.info('[ToolExecution] Completed', {
      agent,
      tool: toolName,
      traceId,
      success: result.success,
      durationMs,
    });

    return {
      ...result,
      meta: {
        ...result.meta,
        durationMs,
        source: agent,
        traceId,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const { code, recoverable } = classifyError(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('[ToolExecution] Failed', {
      agent,
      tool: toolName,
      traceId,
      errorCode: code,
      recoverable,
      durationMs,
      error: errorMessage,
    });

    return {
      success: false,
      message: `Tool '${toolName}' failed: ${errorMessage}`,
      error: {
        code,
        details: error instanceof Error ? error.stack : undefined,
      },
      meta: {
        durationMs,
        source: agent,
        traceId,
      },
    };
  }
}

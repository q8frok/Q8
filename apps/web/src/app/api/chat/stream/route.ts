/**
 * Streaming Chat API Route
 * Server-sent events (SSE) for real-time response streaming
 * Uses unified orchestration service
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamMessage, type OrchestrationEvent, type ExtendedAgentType } from '@/lib/agents/orchestration';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

// Use Node.js runtime for full compatibility with OpenAI and Supabase SDKs
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow longer streaming responses

interface StreamRequest {
  message: string;
  userId: string;
  threadId?: string;
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
  };
  /** Force a specific agent (bypasses routing) */
  forceAgent?: ExtendedAgentType;
  /** Show tool execution events (default: true) */
  showToolExecutions?: boolean;
}

/**
 * Legacy stream event format for backward compatibility
 */
type LegacyStreamEvent =
  | { type: 'routing'; agent: string; reason: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; success: boolean; result?: unknown }
  | { type: 'content'; delta: string }
  | { type: 'done'; fullContent: string; agent: string; threadId: string }
  | { type: 'thread_created'; threadId: string }
  | { type: 'memory_extracted'; count: number }
  | { type: 'error'; message: string };

/**
 * Convert orchestration event to legacy format
 */
function toLegacyEvent(event: OrchestrationEvent): LegacyStreamEvent | null {
  switch (event.type) {
    case 'routing':
      return {
        type: 'routing',
        agent: event.decision.agent,
        reason: event.decision.rationale,
      };
    case 'tool_start':
      return {
        type: 'tool_start',
        tool: event.tool,
        args: event.args,
      };
    case 'tool_end':
      return {
        type: 'tool_end',
        tool: event.tool,
        success: event.success,
        result: event.result,
      };
    case 'content':
      return {
        type: 'content',
        delta: event.delta,
      };
    case 'done':
      return {
        type: 'done',
        fullContent: event.fullContent,
        agent: event.agent,
        threadId: event.threadId,
      };
    case 'thread_created':
      return {
        type: 'thread_created',
        threadId: event.threadId,
      };
    case 'memory_extracted':
      return {
        type: 'memory_extracted',
        count: event.count,
      };
    case 'error':
      return {
        type: 'error',
        message: event.message,
      };
    // Skip agent_start, citation, memory_used - not in legacy format
    default:
      return null;
  }
}

/**
 * Encode SSE event
 */
function encodeSSE(event: LegacyStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  // Authenticate user before starting stream
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const encoder = new TextEncoder();

  // Create a TransformStream for streaming
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Process in background
  (async () => {
    try {
      const body = (await request.json()) as StreamRequest;
      const { message, threadId, userProfile, forceAgent, showToolExecutions = true } = body;
      const userId = user.id; // Use authenticated user ID

      if (!message) {
        await writer.write(encoder.encode(encodeSSE({
          type: 'error',
          message: 'Message is required'
        })));
        await writer.close();
        return;
      }

      // Use unified orchestration streaming
      const eventStream = streamMessage({
        message,
        userId,
        threadId,
        userProfile,
        forceAgent,
        showToolExecutions,
      });

      for await (const event of eventStream) {
        const legacyEvent = toLegacyEvent(event);
        if (legacyEvent) {
          await writer.write(encoder.encode(encodeSSE(legacyEvent)));
        }
      }
    } catch (error) {
      logger.error('[Stream API] Error', { error: error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await writer.write(encoder.encode(encodeSSE({ type: 'error', message: errorMessage })));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

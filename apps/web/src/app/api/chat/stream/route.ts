/**
 * Streaming Chat API Route
 * Server-sent events (SSE) for real-time response streaming
 */

import { NextRequest } from 'next/server';
import { type OrchestrationEvent, type ExtendedAgentType } from '@/lib/agents/orchestration';
import { streamMessage as streamMessageSDK, type AgentType } from '@/lib/agents/sdk';
import {
  EVENT_SCHEMA_VERSION,
  withEventMetadata,
  type VersionedEvent,
} from '@/lib/agents/sdk/events';
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
  /** Recent conversation history for context */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Stream event format - pass all OrchestrationEvent types to frontend
 * No longer filters events - all event types are now supported by the frontend
 */
type StreamEventBase =
  | { type: 'routing'; agent: string; reason: string; confidence: number; source: string }
  | { type: 'agent_start'; agent: string }
  | { type: 'handoff'; from: string; to: string; reason: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; id: string }
  | { type: 'tool_end'; tool: string; success: boolean; result?: unknown; id: string; duration?: number }
  | { type: 'content'; delta: string }
  | { type: 'tts_chunk'; text: string; isComplete: boolean }
  | { type: 'citation'; source: string; url?: string; relevance?: number }
  | { type: 'memory_used'; memoryId: string; content: string; relevance: number }
  | { type: 'image_generated'; imageData: string; mimeType: string; caption?: string; model?: string }
  | { type: 'image_analyzed'; analysis: string; imageUrl?: string }
  | { type: 'done'; fullContent: string; agent: string; threadId: string; images?: Array<{ data: string; mimeType: string; caption?: string }> }
  | { type: 'thread_created'; threadId: string }
  | { type: 'memory_extracted'; count: number }
  | { type: 'widget_action'; widgetId: string; action: string; data?: Record<string, unknown> }
  | { type: 'error'; message: string; recoverable?: boolean };

type StreamEvent = VersionedEvent<StreamEventBase>;

/**
 * Convert orchestration event to stream format
 * Passes all event types through to the frontend for full visibility
 */
function toStreamEvent(event: VersionedEvent<OrchestrationEvent>): StreamEvent {
  const metadata = {
    eventVersion: event.eventVersion,
    runId: event.runId,
    requestId: event.requestId,
    timestamp: event.timestamp,
    correlationId: event.correlationId,
  };

  switch (event.type) {
    case 'routing':
      return {
        ...metadata,
        type: 'routing',
        agent: event.decision.agent,
        reason: event.decision.rationale,
        confidence: event.decision.confidence,
        source: event.decision.source,
      };
    case 'agent_start':
      return {
        ...metadata,
        type: 'agent_start',
        agent: event.agent,
      };
    case 'handoff':
      return {
        ...metadata,
        type: 'handoff',
        from: event.from,
        to: event.to,
        reason: event.reason,
      };
    case 'tool_start':
      return {
        ...metadata,
        type: 'tool_start',
        tool: event.tool,
        args: event.args,
        id: event.id,
      };
    case 'tool_end':
      return {
        ...metadata,
        type: 'tool_end',
        tool: event.tool,
        success: event.success,
        result: event.result,
        id: event.id,
        duration: event.duration,
      };
    case 'content':
      return {
        ...metadata,
        type: 'content',
        delta: event.delta,
      };
    case 'tts_chunk':
      return {
        ...metadata,
        type: 'tts_chunk',
        text: event.text,
        isComplete: event.isComplete,
      };
    case 'citation':
      return {
        ...metadata,
        type: 'citation',
        source: event.source,
        url: event.url,
        relevance: event.relevance,
      };
    case 'memory_used':
      return {
        ...metadata,
        type: 'memory_used',
        memoryId: event.memoryId,
        content: event.content,
        relevance: event.relevance,
      };
    case 'image_generated':
      return {
        ...metadata,
        type: 'image_generated',
        imageData: event.imageData,
        mimeType: event.mimeType,
        caption: event.caption,
        model: event.model,
      };
    case 'image_analyzed':
      return {
        ...metadata,
        type: 'image_analyzed',
        analysis: event.analysis,
        imageUrl: event.imageUrl,
      };
    case 'done':
      return {
        ...metadata,
        type: 'done',
        fullContent: event.fullContent,
        agent: event.agent,
        threadId: event.threadId,
        images: event.images,
      };
    case 'thread_created':
      return {
        ...metadata,
        type: 'thread_created',
        threadId: event.threadId,
      };
    case 'memory_extracted':
      return {
        ...metadata,
        type: 'memory_extracted',
        count: event.count,
      };
    case 'widget_action':
      return {
        ...metadata,
        type: 'widget_action',
        widgetId: event.widgetId,
        action: event.action,
        data: event.data,
      };
    case 'error':
      return {
        ...metadata,
        type: 'error',
        message: event.message,
        recoverable: event.recoverable,
      };
  }
}


/**
 * Encode SSE event
 */
function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  // Authenticate user before starting stream
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const apiRunId = crypto.randomUUID();

  const encoder = new TextEncoder();

  // Create a TransformStream for streaming
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Process in background
  (async () => {
    try {
      const body = (await request.json()) as StreamRequest;
      const { message, threadId, userProfile, forceAgent, showToolExecutions = true, conversationHistory } = body;
      const userId = user.id; // Use authenticated user ID

      if (!message) {
        const errorEvent = withEventMetadata(
          { type: 'error' as const, message: 'Message is required' },
          { runId: apiRunId, requestId, correlationId: requestId },
        );
        await writer.write(encoder.encode(encodeSSE(errorEvent)));
        await writer.close();
        return;
      }

      logger.debug('[Stream API] Processing message', {
        requestId,
        runId: apiRunId,
        userId,
        threadId,
        forceAgent,
      });

      logger.debug('[Stream API] Using event schema version', {
        eventVersion: EVENT_SCHEMA_VERSION,
        requestId,
        runId: apiRunId,
      });

      const eventStream: AsyncGenerator<VersionedEvent<OrchestrationEvent>> = streamMessageSDK({
        message,
        userId,
        threadId,
        userProfile,
        forceAgent: forceAgent as AgentType | undefined,
        showToolExecutions,
        conversationHistory,
        signal: request.signal,
        requestId,
        correlationId: threadId,
      });

      for await (const event of eventStream) {
        const streamEvent = toStreamEvent(event);
        logger.debug('[Stream API] Emitting event', {
          requestId: event.requestId,
          runId: event.runId,
          eventType: event.type,
          eventVersion: event.eventVersion,
        });
        await writer.write(encoder.encode(encodeSSE(streamEvent)));
      }
    } catch (error) {
      logger.error('[Stream API] Error', {
        requestId,
        runId: apiRunId,
        error: error,
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      try {
        const errorEvent = withEventMetadata(
          { type: 'error' as const, message: errorMessage },
          { runId: apiRunId, requestId, correlationId: requestId },
        );
        await writer.write(encoder.encode(encodeSSE(errorEvent)));
      } catch {
        // Writer may already be closed if client disconnected
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Writer may already be closed
      }
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

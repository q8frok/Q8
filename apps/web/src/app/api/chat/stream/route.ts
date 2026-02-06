/**
 * Streaming Chat API Route
 * Server-sent events (SSE) for real-time response streaming
 */

import { NextRequest } from 'next/server';
import { type OrchestrationEvent, type ExtendedAgentType } from '@/lib/agents/orchestration';
import { streamMessage as streamMessageSDK, type AgentType } from '@/lib/agents/sdk';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase/server';

// Use Node.js runtime for full compatibility with OpenAI and Supabase SDKs
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow longer streaming responses

const IDEMPOTENCY_TTL_HOURS = 24;

type RequestStatus = 'processing' | 'completed' | 'failed';

interface StreamIdempotencyRecord {
  id: string;
  user_id: string;
  thread_id: string;
  request_id: string;
  status: RequestStatus;
  run_thread_id: string | null;
  run_agent: string | null;
  user_message: string | null;
  assistant_message: string | null;
  created_thread: boolean;
  expires_at: string;
}

interface StreamRequest {
  message: string;
  userId: string;
  threadId?: string;
  requestId: string;
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
type StreamEvent =
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
  | { type: 'done'; fullContent: string; agent: string; threadId: string; images?: Array<{ data: string; mimeType: string; caption?: string }>; replayed?: boolean }
  | { type: 'thread_created'; threadId: string }
  | { type: 'memory_extracted'; count: number }
  | { type: 'widget_action'; widgetId: string; action: string; data?: Record<string, unknown> }
  | { type: 'error'; message: string; recoverable?: boolean };

/**
 * Convert orchestration event to stream format
 * Passes all event types through to the frontend for full visibility
 */
function toStreamEvent(event: OrchestrationEvent): StreamEvent {
  switch (event.type) {
    case 'routing':
      return {
        type: 'routing',
        agent: event.decision.agent,
        reason: event.decision.rationale,
        confidence: event.decision.confidence,
        source: event.decision.source,
      };
    case 'agent_start':
      return {
        type: 'agent_start',
        agent: event.agent,
      };
    case 'handoff':
      return {
        type: 'handoff',
        from: event.from,
        to: event.to,
        reason: event.reason,
      };
    case 'tool_start':
      return {
        type: 'tool_start',
        tool: event.tool,
        args: event.args,
        id: event.id,
      };
    case 'tool_end':
      return {
        type: 'tool_end',
        tool: event.tool,
        success: event.success,
        result: event.result,
        id: event.id,
        duration: event.duration,
      };
    case 'content':
      return {
        type: 'content',
        delta: event.delta,
      };
    case 'tts_chunk':
      return {
        type: 'tts_chunk',
        text: event.text,
        isComplete: event.isComplete,
      };
    case 'citation':
      return {
        type: 'citation',
        source: event.source,
        url: event.url,
        relevance: event.relevance,
      };
    case 'memory_used':
      return {
        type: 'memory_used',
        memoryId: event.memoryId,
        content: event.content,
        relevance: event.relevance,
      };
    case 'image_generated':
      return {
        type: 'image_generated',
        imageData: event.imageData,
        mimeType: event.mimeType,
        caption: event.caption,
        model: event.model,
      };
    case 'image_analyzed':
      return {
        type: 'image_analyzed',
        analysis: event.analysis,
        imageUrl: event.imageUrl,
      };
    case 'done':
      return {
        type: 'done',
        fullContent: event.fullContent,
        agent: event.agent,
        threadId: event.threadId,
        images: event.images,
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
    case 'widget_action':
      return {
        type: 'widget_action',
        widgetId: event.widgetId,
        action: event.action,
        data: event.data,
      };
    case 'error':
      return {
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

async function cleanupExpiredIdempotencyRecords(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('chat_stream_idempotency')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    logger.warn('[Stream API] Failed idempotency cleanup', { error });
  }
}

async function replayExistingRun(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  existing: StreamIdempotencyRecord,
): Promise<void> {
  if (existing.created_thread && existing.run_thread_id) {
    await writer.write(encoder.encode(encodeSSE({
      type: 'thread_created',
      threadId: existing.run_thread_id,
    })));
  }

  if (existing.status === 'completed' && existing.run_thread_id) {
    await writer.write(encoder.encode(encodeSSE({
      type: 'done',
      fullContent: existing.assistant_message ?? '',
      agent: existing.run_agent ?? 'orchestrator',
      threadId: existing.run_thread_id,
      replayed: true,
    })));
    return;
  }

  await writer.write(encoder.encode(encodeSSE({
    type: 'error',
    message: 'Duplicate request is already being processed',
    recoverable: true,
  })));
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
    let idempotencyId: string | null = null;

    try {
      const body = (await request.json()) as StreamRequest;
      const { message, threadId, requestId, userProfile, forceAgent, showToolExecutions = true, conversationHistory } = body;
      const userId = user.id; // Use authenticated user ID

      if (!message) {
        await writer.write(encoder.encode(encodeSSE({
          type: 'error',
          message: 'Message is required'
        })));
        await writer.close();
        return;
      }

      if (!threadId) {
        await writer.write(encoder.encode(encodeSSE({
          type: 'error',
          message: 'threadId is required for idempotent stream requests',
        })));
        await writer.close();
        return;
      }

      if (!requestId) {
        await writer.write(encoder.encode(encodeSSE({
          type: 'error',
          message: 'requestId is required',
        })));
        await writer.close();
        return;
      }

      await cleanupExpiredIdempotencyRecords();

      const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000).toISOString();

      const { data: idempotencyRow, error: idempotencyInsertError } = await supabaseAdmin
        .from('chat_stream_idempotency')
        .insert({
          user_id: userId,
          thread_id: threadId,
          request_id: requestId,
          status: 'processing',
          user_message: message,
          expires_at: expiresAt,
        })
        .select('*')
        .single();

      if (idempotencyInsertError) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from('chat_stream_idempotency')
          .select('*')
          .eq('user_id', userId)
          .eq('thread_id', threadId)
          .eq('request_id', requestId)
          .maybeSingle();

        if (existingError || !existing) {
          throw idempotencyInsertError;
        }

        logger.info('[Stream API] Duplicate request detected, replaying stored metadata', {
          userId,
          threadId,
          requestId,
          status: existing.status,
        });

        await replayExistingRun(writer, encoder, existing as StreamIdempotencyRecord);
        await writer.close();
        return;
      }

      idempotencyId = idempotencyRow.id;

      logger.debug('[Stream API] Processing message', {
        userId,
        threadId,
        requestId,
        forceAgent,
      });

      let finalDoneEvent: Extract<StreamEvent, { type: 'done' }> | null = null;
      let createdThread = false;

      const eventStream: AsyncGenerator<OrchestrationEvent> = streamMessageSDK({
        message,
        userId,
        threadId,
        userProfile,
        forceAgent: forceAgent as AgentType | undefined,
        showToolExecutions,
        conversationHistory,
        signal: request.signal,
      });

      for await (const event of eventStream) {
        const streamEvent = toStreamEvent(event);

        if (streamEvent.type === 'thread_created') {
          createdThread = true;
        }

        if (streamEvent.type === 'done') {
          finalDoneEvent = streamEvent;
        }

        await writer.write(encoder.encode(encodeSSE(streamEvent)));
      }

      if (idempotencyId) {
        await supabaseAdmin
          .from('chat_stream_idempotency')
          .update({
            status: 'completed',
            run_thread_id: finalDoneEvent?.threadId ?? threadId,
            run_agent: finalDoneEvent?.agent ?? null,
            assistant_message: finalDoneEvent?.fullContent ?? null,
            created_thread: createdThread,
          })
          .eq('id', idempotencyId);
      }
    } catch (error) {
      logger.error('[Stream API] Error', { error: error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (idempotencyId) {
        await supabaseAdmin
          .from('chat_stream_idempotency')
          .update({ status: 'failed' })
          .eq('id', idempotencyId);
      }

      try {
        await writer.write(encoder.encode(encodeSSE({ type: 'error', message: errorMessage })));
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

/**
 * Streaming Chat API Route
 * Server-sent events (SSE) for real-time response streaming
 *
 * Integrates:
 * - Server-canonical conversation history (no client-provided transcript)
 * - Run lifecycle events (run_created / run_state)
 * - Client requestId idempotency with replay
 * - Versioned event metadata wrapping
 */

import { NextRequest } from 'next/server';
import { type OrchestrationEvent, type ExtendedAgentType } from '@/lib/agents/orchestration/types';
import { executeChatStream, type ChatFailure, type ChatFailureClass } from '@/lib/agents/sdk/chat-service';
import { classifyError } from '@/lib/agents/sdk/utils/errors';
import {
  EVENT_SCHEMA_VERSION,
  type EventTraceContext,
} from '@/lib/agents/sdk/events';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { fetchCanonicalConversationHistory } from '@/lib/server/chat-history';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { ChatMessageInsert } from '@/lib/supabase/types';

// Use Node.js runtime for full compatibility with OpenAI and Supabase SDKs
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow longer streaming responses

// =============================================================================
// IDEMPOTENCY
// =============================================================================

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

// =============================================================================
// REQUEST / EVENT TYPES
// =============================================================================

interface StreamRequest {
  message: string;
  threadId?: string;
  requestId?: string;
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

type StreamEventBase =
  | { type: 'run_created'; runId: string; state: 'queued'; timestamp: string }
  | { type: 'run_state'; state: string; agent?: string; detail?: string; runId?: string; timestamp?: string }
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
  | {
      type: 'done';
      fullContent: string;
      agent: string;
      threadId: string;
      images?: Array<{ data: string; mimeType: string; caption?: string }>;
      agentSelection: { agent: string; confidence: number; rationale: string; source: string };
      toolSummary: { total: number; succeeded: number; failed: number; tools: string[] };
      failure: null;
      replayed?: boolean;
    }
  | { type: 'thread_created'; threadId: string }
  | { type: 'memory_extracted'; count: number }
  | { type: 'widget_action'; widgetId: string; action: string; data?: Record<string, unknown> }
  | { type: 'interruption_required'; tools: Array<{ name: string; args: Record<string, unknown>; id: string; description?: string }>; serializedState?: string }
  | { type: 'interruption_resolved'; toolId: string; approved: boolean }
  | { type: 'guardrail_triggered'; guardrail: string; message: string }
  | { type: 'reasoning_start' }
  | { type: 'reasoning_end'; durationMs?: number }
  | { type: 'error'; message: string; recoverable?: boolean; failure?: ChatFailure };

type StreamEvent = StreamEventBase & {
  eventVersion?: number;
  runId?: string;
  requestId?: string;
  timestamp?: string;
  correlationId?: string;
};

// =============================================================================
// HELPERS
// =============================================================================

function toStreamEvent(event: OrchestrationEvent): StreamEventBase {
  switch (event.type) {
    case 'routing':
      return { type: 'routing', agent: event.decision.agent, reason: event.decision.rationale, confidence: event.decision.confidence, source: event.decision.source };
    case 'agent_start':
      return { type: 'agent_start', agent: event.agent };
    case 'handoff':
      return { type: 'handoff', from: event.from, to: event.to, reason: event.reason };
    case 'tool_start':
      return { type: 'tool_start', tool: event.tool, args: event.args, id: event.id };
    case 'tool_end':
      return { type: 'tool_end', tool: event.tool, success: event.success, result: event.result, id: event.id, duration: event.duration };
    case 'content':
      return { type: 'content', delta: event.delta };
    case 'tts_chunk':
      return { type: 'tts_chunk', text: event.text, isComplete: event.isComplete };
    case 'citation':
      return { type: 'citation', source: event.source, url: event.url, relevance: event.relevance };
    case 'memory_used':
      return { type: 'memory_used', memoryId: event.memoryId, content: event.content, relevance: event.relevance };
    case 'image_generated':
      return { type: 'image_generated', imageData: event.imageData, mimeType: event.mimeType, caption: event.caption, model: event.model };
    case 'image_analyzed':
      return { type: 'image_analyzed', analysis: event.analysis, imageUrl: event.imageUrl };
    case 'thread_created':
      return { type: 'thread_created', threadId: event.threadId };
    case 'memory_extracted':
      return { type: 'memory_extracted', count: event.count };
    case 'widget_action':
      return { type: 'widget_action', widgetId: event.widgetId, action: event.action, data: event.data };
    case 'interruption_required':
      return { type: 'interruption_required', tools: event.tools, serializedState: event.serializedState };
    case 'interruption_resolved':
      return { type: 'interruption_resolved', toolId: event.toolId, approved: event.approved };
    case 'guardrail_triggered':
      return { type: 'guardrail_triggered', guardrail: event.guardrail, message: event.message };
    case 'reasoning_start':
      return { type: 'reasoning_start' };
    case 'reasoning_end':
      return { type: 'reasoning_end', durationMs: event.durationMs };
    case 'run_state':
      return { type: 'run_state', state: event.state, agent: event.agent, detail: event.detail };
    case 'done':
    case 'error':
      throw new Error(`Unexpected ${event.type} in passthrough mapping`);
  }
}

function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function toFailureClass(code: string): ChatFailureClass {
  switch (code) {
    case 'RATE_LIMITED': return 'rate_limit';
    case 'TIMEOUT': return 'timeout';
    case 'CONNECTION_ERROR': return 'connection';
    case 'AUTH_ERROR': return 'auth';
    case 'VALIDATION_ERROR': return 'validation';
    case 'NOT_FOUND': return 'not_found';
    default: return 'unknown';
  }
}

function stamp(base: StreamEventBase, trace: EventTraceContext): StreamEvent {
  return {
    ...base,
    eventVersion: EVENT_SCHEMA_VERSION,
    runId: trace.runId,
    requestId: trace.requestId,
    correlationId: trace.correlationId,
    timestamp: new Date().toISOString(),
  };
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
  trace: EventTraceContext,
): Promise<void> {
  if (existing.created_thread && existing.run_thread_id) {
    await writer.write(encoder.encode(encodeSSE(stamp(
      { type: 'thread_created', threadId: existing.run_thread_id },
      trace,
    ))));
  }

  if (existing.status === 'completed' && existing.run_thread_id) {
    await writer.write(encoder.encode(encodeSSE(stamp(
      {
        type: 'done',
        fullContent: existing.assistant_message ?? '',
        agent: existing.run_agent ?? 'orchestrator',
        threadId: existing.run_thread_id,
        replayed: true,
        agentSelection: { agent: existing.run_agent ?? 'orchestrator', confidence: 1, rationale: 'Replayed', source: 'idempotency' },
        toolSummary: { total: 0, succeeded: 0, failed: 0, tools: [] },
        failure: null,
      },
      trace,
    ))));
    return;
  }

  await writer.write(encoder.encode(encodeSSE(stamp(
    { type: 'error', message: 'Duplicate request is already being processed', recoverable: true },
    trace,
  ))));
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const apiRunId = crypto.randomUUID();

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  (async () => {
    let currentRouting = { agent: 'orchestrator', confidence: 0, rationale: 'Routing unavailable', source: 'fallback' };
    const toolStartMap = new Map<string, { tool: string; args: Record<string, unknown>; startedAt: number }>();
    const toolEndEvents: Array<{ id: string; tool: string; success: boolean; args: Record<string, unknown>; result?: unknown; duration?: number }> = [];
    let idempotencyId: string | null = null;

    const trace: EventTraceContext = {
      runId: apiRunId,
      requestId,
      correlationId: requestId,
    };

    const emitRunState = async (state: 'queued' | 'running' | 'awaiting_tool' | 'completed' | 'failed' | 'cancelled') => {
      await writer.write(encoder.encode(encodeSSE(stamp(
        { type: 'run_state', runId: apiRunId, state, timestamp: new Date().toISOString() },
        trace,
      ))));
    };

    try {
      const body = (await request.json()) as StreamRequest;
      const { message, threadId, requestId: clientRequestId, userProfile, forceAgent, showToolExecutions = true } = body;
      const userId = user.id;

      // Update trace correlation from threadId if available
      if (threadId) {
        trace.correlationId = threadId;
      }
      // Prefer client-provided requestId when available
      const effectiveRequestId = clientRequestId || requestId;
      trace.requestId = effectiveRequestId;

      if (!message) {
        const failure: ChatFailure = { class: 'validation', code: 'VALIDATION_ERROR', recoverable: false, message: 'Message is required' };
        await writer.write(encoder.encode(encodeSSE(stamp(
          { type: 'error', message: failure.message, recoverable: failure.recoverable, failure },
          trace,
        ))));
        await writer.close();
        return;
      }

      // --- Ensure thread exists in DB (FK required by idempotency + chat_messages) ---
      if (threadId) {
        const { error: threadUpsertError } = await supabaseAdmin
          .from('threads')
          .upsert({ id: threadId, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true });
        if (threadUpsertError) {
          logger.warn('[Stream API] Failed to ensure thread exists', { threadId, error: threadUpsertError });
        }
      }

      // --- Idempotency check (when both threadId and requestId are present) ---
      if (threadId && clientRequestId) {
        await cleanupExpiredIdempotencyRecords();

        const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000).toISOString();

        const { data: idempotencyRow, error: idempotencyInsertError } = await supabaseAdmin
          .from('chat_stream_idempotency')
          .insert({
            user_id: userId,
            thread_id: threadId,
            request_id: clientRequestId,
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
            .eq('request_id', clientRequestId)
            .maybeSingle();

          if (existingError || !existing) {
            throw idempotencyInsertError;
          }

          logger.info('[Stream API] Duplicate request detected, replaying stored metadata', {
            userId,
            threadId,
            requestId: clientRequestId,
            status: existing.status,
          });

          await replayExistingRun(writer, encoder, existing as StreamIdempotencyRecord, trace);
          await writer.close();
          return;
        }

        idempotencyId = idempotencyRow.id;
      }

      // --- Emit run_created ---
      await writer.write(encoder.encode(encodeSSE(stamp(
        { type: 'run_created', runId: apiRunId, state: 'queued', timestamp: new Date().toISOString() },
        trace,
      ))));
      await emitRunState('queued');

      logger.debug('[Stream API] Processing message', {
        requestId: effectiveRequestId,
        runId: apiRunId,
        userId,
        threadId,
        forceAgent,
        eventVersion: EVENT_SCHEMA_VERSION,
      });

      // --- Persist user message (so follow-ups have history) ---
      if (threadId) {
        try {
          await supabaseAdmin.from('chat_messages').insert({
            id: crypto.randomUUID(),
            thread_id: threadId,
            user_id: userId,
            role: 'user',
            content: message,
          } as ChatMessageInsert);
        } catch (persistErr) {
          logger.warn('[Stream API] Failed to persist user message', { threadId, error: persistErr });
        }
      }

      // --- Fetch server-canonical history (PR #7) ---
      const canonicalConversationHistory = threadId
        ? await fetchCanonicalConversationHistory(threadId)
        : [];

      const eventStream = executeChatStream({
        message,
        userId,
        threadId,
        userProfile,
        forceAgent,
        showToolExecutions,
        historyOverride: canonicalConversationHistory,
        signal: request.signal,
        requestId: effectiveRequestId,
        correlationId: threadId,
      });

      let finalDoneEvent: (StreamEventBase & { type: 'done' }) | null = null;
      let createdThread = false;

      for await (const event of eventStream) {
        // Propagate versioned metadata from the runner events
        const raw = event as Record<string, unknown>;
        const eventMeta: Partial<Pick<StreamEvent, 'eventVersion' | 'runId' | 'requestId' | 'timestamp' | 'correlationId'>> = {
          ...(raw.eventVersion != null ? { eventVersion: raw.eventVersion as number } : {}),
          ...(raw.runId != null ? { runId: raw.runId as string } : {}),
          ...(raw.requestId != null ? { requestId: raw.requestId as string } : {}),
          ...(raw.timestamp != null ? { timestamp: raw.timestamp as string } : {}),
          ...(raw.correlationId != null ? { correlationId: raw.correlationId as string } : {}),
        };

        // Run state transitions (PR #8)
        if (event.type === 'agent_start') {
          await emitRunState('running');
        }
        if (event.type === 'tool_start') {
          toolStartMap.set(event.id, { tool: event.tool, args: event.args, startedAt: Date.now() });
          await emitRunState('awaiting_tool');
        }
        if (event.type === 'tool_end') {
          await emitRunState('running');
        }

        if (event.type === 'routing') {
          currentRouting = {
            agent: event.decision.agent,
            confidence: event.decision.confidence,
            rationale: event.decision.rationale,
            source: event.decision.source,
          };
          const mapped = toStreamEvent(event);
          await writer.write(encoder.encode(encodeSSE({ ...mapped, ...eventMeta })));
          continue;
        }

        if (event.type === 'tool_end') {
          const startInfo = toolStartMap.get(event.id);
          toolEndEvents.push({
            id: event.id,
            tool: event.tool,
            success: event.success,
            args: startInfo?.args ?? {},
            result: event.result,
            duration: event.duration ?? (startInfo ? Date.now() - startInfo.startedAt : undefined),
          });
          toolStartMap.delete(event.id);
          const mapped = toStreamEvent(event);
          await writer.write(encoder.encode(encodeSSE({ ...mapped, ...eventMeta })));
          continue;
        }

        if (event.type === 'thread_created') {
          createdThread = true;
          // Persist the new thread to the DB
          const { error: newThreadErr } = await supabaseAdmin
            .from('threads')
            .upsert({ id: event.threadId, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true });
          if (newThreadErr) {
            logger.warn('[Stream API] Failed to persist new thread', { threadId: event.threadId, error: newThreadErr });
          }
          const mapped = toStreamEvent(event);
          await writer.write(encoder.encode(encodeSSE({ ...mapped, ...eventMeta })));
          continue;
        }

        if (event.type === 'done') {
          const failed = toolEndEvents.filter((t) => !t.success).length;
          const doneBase: StreamEventBase & { type: 'done' } = {
            type: 'done',
            fullContent: event.fullContent,
            agent: event.agent,
            threadId: event.threadId,
            images: event.images,
            agentSelection: currentRouting,
            toolSummary: {
              total: toolEndEvents.length,
              succeeded: toolEndEvents.length - failed,
              failed,
              tools: [...new Set(toolEndEvents.map((t) => t.tool))],
            },
            failure: null,
          };
          finalDoneEvent = doneBase;

          // --- Persist assistant message with tool executions & metadata ---
          const persistThreadId = event.threadId || threadId;
          if (persistThreadId && event.fullContent) {
            const persistedToolExecutions = toolEndEvents.map(t => ({
              id: t.id,
              tool: t.tool,
              args: t.args,
              status: (t.success ? 'completed' : 'failed') as 'completed' | 'failed',
              result: t.result,
              duration: t.duration,
            }));
            try {
              await supabaseAdmin.from('chat_messages').insert({
                id: crypto.randomUUID(),
                thread_id: persistThreadId,
                user_id: userId,
                role: 'assistant',
                content: event.fullContent,
                agent_name: event.agent,
                tool_executions: persistedToolExecutions.length > 0 ? persistedToolExecutions : undefined,
                metadata: {
                  runId: apiRunId,
                  requestId: effectiveRequestId,
                  agentSelection: currentRouting,
                  toolSummary: doneBase.toolSummary,
                },
              } as ChatMessageInsert);
            } catch (persistErr) {
              logger.warn('[Stream API] Failed to persist assistant message', { threadId: persistThreadId, error: persistErr });
            }
          }

          await emitRunState('completed');
          await writer.write(encoder.encode(encodeSSE({ ...doneBase, ...eventMeta })));
          continue;
        }

        if (event.type === 'error') {
          const classification = classifyError(event.message);
          const failure: ChatFailure = {
            class: toFailureClass(classification.code),
            code: classification.code,
            recoverable: classification.recoverable,
            message: event.message,
          };
          await writer.write(encoder.encode(encodeSSE({ type: 'error', message: event.message, recoverable: event.recoverable, failure, ...eventMeta })));
          continue;
        }

        const mapped = toStreamEvent(event);
        await writer.write(encoder.encode(encodeSSE({ ...mapped, ...eventMeta })));
      }

      // Update idempotency record on success
      if (idempotencyId) {
        await supabaseAdmin
          .from('chat_stream_idempotency')
          .update({
            status: 'completed',
            run_thread_id: finalDoneEvent?.threadId ?? threadId ?? null,
            run_agent: finalDoneEvent?.agent ?? null,
            assistant_message: finalDoneEvent?.fullContent ?? null,
            created_thread: createdThread,
          })
          .eq('id', idempotencyId);
      }
    } catch (error) {
      const state: 'cancelled' | 'failed' = request.signal.aborted ? 'cancelled' : 'failed';
      try { await emitRunState(state); } catch { /* writer may be closed */ }

      logger.error('[Stream API] Error', {
        requestId,
        runId: apiRunId,
        error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorString: String(error),
      });
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : typeof error === 'object' && error !== null
            ? JSON.stringify(error).slice(0, 500)
            : 'Unknown error';
      const classification = classifyError(errorMessage);
      const failure: ChatFailure = {
        class: toFailureClass(classification.code),
        code: classification.code,
        recoverable: classification.recoverable,
        message: errorMessage,
      };

      if (idempotencyId) {
        try {
          await supabaseAdmin
            .from('chat_stream_idempotency')
            .update({ status: 'failed' })
            .eq('id', idempotencyId);
        } catch { /* ignore cleanup errors */ }
      }

      try {
        await writer.write(encoder.encode(encodeSSE(stamp(
          { type: 'error', message: errorMessage, recoverable: classification.recoverable, failure },
          trace,
        ))));
      } catch { /* writer may be closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

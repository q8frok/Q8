/**
 * Streaming Chat API Route
 * Server-sent events (SSE) for real-time response streaming
 */

import { NextRequest } from 'next/server';
import { type OrchestrationEvent, type ExtendedAgentType } from '@/lib/agents/orchestration';
import { executeChatStream, type ChatFailure, type ChatFailureClass } from '@/lib/agents/sdk/chat-service';
import { classifyError } from '@/lib/agents/sdk/utils/errors';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface StreamRequest {
  message: string;
  userId: string;
  threadId?: string;
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
  };
  forceAgent?: ExtendedAgentType;
  showToolExecutions?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

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
  | {
    type: 'done';
    fullContent: string;
    agent: string;
    threadId: string;
    images?: Array<{ data: string; mimeType: string; caption?: string }>;
    agentSelection: { agent: string; confidence: number; rationale: string; source: string };
    toolSummary: { total: number; succeeded: number; failed: number; tools: string[] };
    failure: null;
  }
  | { type: 'thread_created'; threadId: string }
  | { type: 'memory_extracted'; count: number }
  | { type: 'widget_action'; widgetId: string; action: string; data?: Record<string, unknown> }
  | { type: 'error'; message: string; recoverable?: boolean; failure: ChatFailure };

function toStreamEvent(event: OrchestrationEvent): StreamEvent {
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

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  (async () => {
    let currentRouting = { agent: 'orchestrator', confidence: 0, rationale: 'Routing unavailable', source: 'fallback' };
    const toolEndEvents: Array<{ tool: string; success: boolean }> = [];

    try {
      const body = (await request.json()) as StreamRequest;
      const { message, threadId, userProfile, forceAgent, showToolExecutions = true, conversationHistory } = body;
      const userId = user.id;

      if (!message) {
        const failure: ChatFailure = { class: 'validation', code: 'VALIDATION_ERROR', recoverable: false, message: 'Message is required' };
        await writer.write(encoder.encode(encodeSSE({ type: 'error', message: failure.message, recoverable: failure.recoverable, failure })));
        await writer.close();
        return;
      }

      const eventStream = executeChatStream({
        message,
        userId,
        threadId,
        userProfile,
        forceAgent,
        showToolExecutions,
        conversationHistory,
        signal: request.signal,
      });

      for await (const event of eventStream) {
        if (event.type === 'routing') {
          currentRouting = {
            agent: event.decision.agent,
            confidence: event.decision.confidence,
            rationale: event.decision.rationale,
            source: event.decision.source,
          };
          await writer.write(encoder.encode(encodeSSE(toStreamEvent(event))));
          continue;
        }

        if (event.type === 'tool_end') {
          toolEndEvents.push({ tool: event.tool, success: event.success });
          await writer.write(encoder.encode(encodeSSE(toStreamEvent(event))));
          continue;
        }

        if (event.type === 'done') {
          const failed = toolEndEvents.filter((t) => !t.success).length;
          const doneEvent: StreamEvent = {
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
          await writer.write(encoder.encode(encodeSSE(doneEvent)));
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
          await writer.write(encoder.encode(encodeSSE({ type: 'error', message: event.message, recoverable: event.recoverable, failure })));
          continue;
        }

        await writer.write(encoder.encode(encodeSSE(toStreamEvent(event))));
      }
    } catch (error) {
      logger.error('[Stream API] Error', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const classification = classifyError(errorMessage);
      const failure: ChatFailure = {
        class: toFailureClass(classification.code),
        code: classification.code,
        recoverable: classification.recoverable,
        message: errorMessage,
      };
      try {
        await writer.write(encoder.encode(encodeSSE({ type: 'error', message: errorMessage, recoverable: classification.recoverable, failure })));
      } catch {}
    } finally {
      try { await writer.close(); } catch {}
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

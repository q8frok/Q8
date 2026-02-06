/**
 * Agent Runner - Powered by @openai/agents SDK
 *
 * Uses SDK's run() with streaming for:
 * - True token-level streaming via raw_model_stream_event
 * - Native tool execution loop (SDK handles the tool call → result → re-invoke cycle)
 * - Native handoffs via SDK Handoff objects (orchestrator delegates to specialists)
 * - Event mapping from SDK events → OrchestrationEvent for UI compatibility
 *
 * The custom 3-tier router is preserved for initial agent selection.
 */

import { run } from '@openai/agents';
import type { RunStreamEvent, AgentInputItem } from '@openai/agents';
import { logger } from '@/lib/logger';
import type { OrchestrationEvent } from '../orchestration/types';
import {
  orchestratorAgent,
  getAgent,
  getAgentType,
  type AgentType,
} from './agents';
import {
  route,
  toOrchestrationRoutingDecision,
  type SDKRoutingDecision,
} from './router';
import { classifyError } from './utils/errors';
import {
  withEventMetadata,
  type EventTraceContext,
  type VersionedEvent,
} from './events';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Execution context for running an agent
 */
export interface RunContext {
  userId: string;
  threadId?: string;
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
  };
}

/**
 * Options for streamMessage
 */
export interface StreamMessageOptions {
  message: string;
  userId: string;
  threadId?: string;
  userProfile?: RunContext['userProfile'];
  forceAgent?: AgentType;
  showToolExecutions?: boolean;
  maxTurns?: number;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
  requestId?: string;
  correlationId?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_TURNS = 10;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build AgentInputItem[] from conversation history + current message.
 * UserMessageItem accepts content as string, while AssistantMessageItem
 * requires content as an array of output items.
 */
function buildInput(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
): AgentInputItem[] {
  const items: AgentInputItem[] = conversationHistory.map(m => {
    if (m.role === 'user') {
      return { role: 'user' as const, content: m.content };
    }
    // Assistant messages require content as array of output items
    return {
      role: 'assistant' as const,
      content: [{ type: 'output_text' as const, text: m.content }],
    };
  });
  items.push({ role: 'user' as const, content: message });
  return items;
}

/**
 * Build dynamic instructions with user context appended
 */
function buildUserContext(userProfile?: RunContext['userProfile']): string {
  let context = '';
  if (userProfile) {
    const { name, timezone, communicationStyle } = userProfile;
    if (name) context += `\nThe user's name is ${name}.`;
    if (timezone) context += `\nThe user is in timezone: ${timezone}.`;
    if (communicationStyle === 'concise') {
      context += '\nThe user prefers concise, to-the-point responses.';
    } else if (communicationStyle === 'detailed') {
      context += '\nThe user prefers detailed, thorough responses.';
    }
  }
  context += `\n\nCurrent date and time: ${new Date().toISOString()}`;
  return context;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Stream a message through the orchestration system using @openai/agents SDK
 *
 * Flow:
 * 1. Route message → select agent (custom 3-tier router)
 * 2. Clone agent with user context appended to instructions
 * 3. run(agent, input, { stream: true }) → SDK handles tool loops + handoffs
 * 4. Map SDK events → OrchestrationEvent for UI
 */
export async function* streamMessage(
  options: StreamMessageOptions
): AsyncGenerator<VersionedEvent<OrchestrationEvent>> {
  const {
    message,
    userId,
    threadId: providedThreadId,
    userProfile,
    forceAgent,
    showToolExecutions = true,
    maxTurns = DEFAULT_MAX_TURNS,
    conversationHistory = [],
    signal,
    requestId: providedRequestId,
    correlationId,
  } = options;

  const threadId = providedThreadId ?? crypto.randomUUID();
  const runId = crypto.randomUUID();
  const requestId = providedRequestId ?? crypto.randomUUID();
  const traceContext: EventTraceContext = {
    runId,
    requestId,
    correlationId: correlationId ?? threadId,
  };
  const startTime = Date.now();

  // Emit thread_created if new
  if (!providedThreadId) {
    yield withEventMetadata({ type: 'thread_created', threadId }, traceContext);
  }

  try {
    // Step 1: Route the message
    let routingDecision: SDKRoutingDecision;

    if (forceAgent) {
      routingDecision = {
        agent: forceAgent,
        confidence: 1.0,
        rationale: 'Agent specified by caller',
        source: 'explicit',
      };
    } else {
      routingDecision = await route(message);
    }

    yield withEventMetadata({
      type: 'routing',
      decision: toOrchestrationRoutingDecision(routingDecision),
    }, traceContext);

    // Step 2: Get and prepare the agent
    const selectedType = routingDecision.agent;
    const baseAgent = selectedType === 'orchestrator'
      ? orchestratorAgent
      : getAgent(selectedType);

    // Append user context to agent instructions
    const userContext = buildUserContext(userProfile);
    const agent = baseAgent.clone({
      instructions: (typeof baseAgent.instructions === 'string'
        ? baseAgent.instructions
        : '') + userContext,
    });

    yield withEventMetadata({ type: 'agent_start', agent: selectedType }, traceContext);

    // Step 3: Run with streaming
    const input = conversationHistory.length > 0
      ? buildInput(conversationHistory, message)
      : message;

    const runContext: RunContext = {
      userId,
      threadId,
      userProfile,
    };

    const streamResult = await run(agent, input, {
      stream: true,
      maxTurns,
      signal,
      context: runContext,
    });

    // Track state for event mapping
    let fullContent = '';
    let currentAgentType: AgentType = selectedType;
    const toolStartTimes = new Map<string, number>();

    // Step 4: Process SDK events → OrchestrationEvent
    for await (const event of streamResult) {
      const mapped = mapSdkEvent(
        event,
        showToolExecutions,
        currentAgentType,
        toolStartTimes,
      );

      if (mapped) {
        // Track content accumulation
        if (mapped.type === 'content') {
          fullContent += mapped.delta;
        }

        // Track agent changes
        if (mapped.type === 'handoff') {
          currentAgentType = mapped.to as AgentType;
        }

        yield withEventMetadata(mapped, traceContext);
      }
    }

    // Wait for stream completion
    await streamResult.completed;

    // Determine final agent
    const finalAgent = streamResult.lastAgent;
    const finalAgentType = finalAgent
      ? (getAgentType(finalAgent) ?? selectedType)
      : selectedType;

    const duration = Date.now() - startTime;
    logger.info('streamMessage completed', {
      runId,
      requestId,
      agent: finalAgentType,
      durationMs: duration,
      contentLength: fullContent.length,
    });

    yield withEventMetadata({
      type: 'done',
      fullContent,
      agent: finalAgentType,
      threadId,
    }, traceContext);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const classification = classifyError(error) ?? { recoverable: false };

    logger.error('streamMessage failed', {
      runId,
      requestId,
      userId,
      threadId,
      error: errorMessage,
    });

    yield withEventMetadata({
      type: 'error',
      message: errorMessage,
      recoverable: classification.recoverable,
    }, traceContext);
  }
}

// =============================================================================
// EVENT MAPPING
// =============================================================================

/**
 * Map an SDK RunStreamEvent → OrchestrationEvent (or null to skip)
 */
function mapSdkEvent(
  event: RunStreamEvent,
  showToolExecutions: boolean,
  currentAgentType: AgentType,
  toolStartTimes: Map<string, number>,
): OrchestrationEvent | null {
  switch (event.type) {
    // Raw model streaming - extract text deltas
    case 'raw_model_stream_event': {
      const data = event.data;
      if ('type' in data && data.type === 'output_text_delta') {
        const delta = (data as { delta?: string }).delta;
        if (delta) {
          return { type: 'content', delta };
        }
      }
      return null;
    }

    // Run item events - tool calls, tool output, handoffs, messages
    case 'run_item_stream_event': {
      const { name, item } = event;

      switch (name) {
        case 'tool_called': {
          if (!showToolExecutions) return null;
          const raw = item.rawItem as Record<string, unknown> | undefined;
          if (raw && typeof raw.type === 'string' && (raw.type === 'function_call' || raw.type === 'hosted_tool_call')) {
            const callId = (raw.callId ?? raw.id ?? '') as string;
            const toolName = (raw.name ?? '') as string;
            let args: Record<string, unknown> = {};
            try {
              const argsStr = (raw.arguments ?? '') as string;
              if (argsStr) args = JSON.parse(argsStr);
            } catch { /* ignore parse errors */ }

            toolStartTimes.set(callId, Date.now());

            return {
              type: 'tool_start',
              tool: toolName,
              args,
              id: callId,
            };
          }
          return null;
        }

        case 'tool_output': {
          if (!showToolExecutions) return null;
          const raw = item.rawItem as Record<string, unknown> | undefined;
          if (raw && typeof raw.type === 'string' && (raw.type === 'function_call_output' || raw.type === 'hosted_tool_call_output')) {
            const callId = (raw.callId ?? raw.id ?? '') as string;
            const output = (raw.output ?? '') as string;
            const startTime = toolStartTimes.get(callId);
            const duration = startTime ? Date.now() - startTime : undefined;
            toolStartTimes.delete(callId);

            let success = true;
            let result: unknown = output;
            try {
              const parsed = JSON.parse(output);
              if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
                success = Boolean(parsed.success);
              }
              result = parsed;
            } catch { /* leave as string */ }

            const toolName = (raw.name ?? 'unknown') as string;

            return {
              type: 'tool_end',
              tool: toolName,
              success,
              result,
              id: callId,
              duration,
            };
          }
          return null;
        }

        case 'handoff_occurred': {
          // The agent_updated_stream_event provides the definitive new agent info;
          // skip emitting a duplicate handoff event here
          return null;
        }

        default:
          return null;
      }
    }

    // Agent switched (handoff completed)
    case 'agent_updated_stream_event': {
      const newAgent = event.agent;
      const newAgentType = getAgentType(newAgent) ?? 'orchestrator';

      return {
        type: 'handoff',
        from: currentAgentType,
        to: newAgentType,
        reason: `Delegated to ${newAgent.name}`,
      };
    }

    default:
      return null;
  }
}

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
import { checkInputGuardrails } from './guardrails';
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
  /**
   * Optional INTERNAL override used by tests/dev tooling.
   * Production path should pass canonical server-assembled history.
   */
  historyOverride?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** @deprecated use historyOverride */
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
 * Build dynamic instructions with user context appended.
 * Computes human-readable local time from the user's timezone.
 */
function buildUserContext(userProfile?: RunContext['userProfile']): string {
  const parts: string[] = ['\n\n## User Context'];
  const now = new Date();
  const tz = userProfile?.timezone || 'UTC';

  // Compute local time in human-readable format
  try {
    const localDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    });
    const localTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    });
    parts.push(`- **Current time**: ${localDate}, ${localTime} (${tz})`);
  } catch {
    // Fallback if timezone is invalid
    parts.push(`- **Current time**: ${now.toISOString()}`);
  }

  if (userProfile?.name) {
    parts.push(`- **User's name**: ${userProfile.name}`);
  }

  if (userProfile?.communicationStyle === 'concise') {
    parts.push('- **Style preference**: Keep responses concise and to-the-point. Avoid lengthy explanations unless asked.');
  } else if (userProfile?.communicationStyle === 'detailed') {
    parts.push('- **Style preference**: Provide thorough, detailed responses with full explanations and examples.');
  }

  return parts.join('\n');
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
    historyOverride,
    conversationHistory,
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
    // Step 0: Input guardrails
    const guardrailResult = checkInputGuardrails(message);
    if (!guardrailResult.passed) {
      yield withEventMetadata({
        type: 'guardrail_triggered',
        guardrail: guardrailResult.guardrail,
        message: guardrailResult.message ?? 'Request blocked by safety check.',
      }, traceContext);
      yield withEventMetadata({
        type: 'error',
        message: guardrailResult.message ?? 'Request blocked by safety check.',
        recoverable: false,
      }, traceContext);
      return;
    }

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
      type: 'run_state',
      state: 'routing',
      detail: `Selecting capability for: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`,
    }, traceContext);

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
    yield withEventMetadata({
      type: 'run_state',
      state: 'thinking',
      agent: selectedType,
      detail: `${baseAgent.name} is thinking...`,
    }, traceContext);

    // Step 3: Run with streaming
    const prebuiltHistory = historyOverride ?? conversationHistory ?? [];

    const input = prebuiltHistory.length > 0
      ? buildInput(prebuiltHistory, message)
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
    let hasEmittedComposing = false;
    let reasoningStartTime: number | null = null;
    const toolStartTimes = new Map<string, number>();
    const toolNames = new Map<string, string>();

    // Step 4: Process SDK events → OrchestrationEvent
    for await (const event of streamResult) {
      const mapped = mapSdkEvent(
        event,
        showToolExecutions,
        currentAgentType,
        toolStartTimes,
        toolNames,
      );

      if (mapped) {
        // Emit run_state transitions based on event type
        if (mapped.type === 'tool_start') {
          yield withEventMetadata({
            type: 'run_state',
            state: 'tool_executing',
            agent: currentAgentType,
            detail: `Running ${mapped.tool}...`,
          }, traceContext);
        }

        // Track content accumulation
        if (mapped.type === 'content') {
          fullContent += mapped.delta;
          // Emit 'composing' run_state on first content delta
          if (!hasEmittedComposing) {
            hasEmittedComposing = true;
            yield withEventMetadata({
              type: 'run_state',
              state: 'composing',
              agent: currentAgentType,
            }, traceContext);
          }
        }

        // Track agent changes
        if (mapped.type === 'handoff') {
          currentAgentType = mapped.to as AgentType;
          hasEmittedComposing = false; // Reset for new agent
        }

        // Track reasoning events
        if (mapped.type === 'reasoning_start') {
          reasoningStartTime = Date.now();
        }
        if (mapped.type === 'reasoning_end' && reasoningStartTime) {
          mapped.durationMs = Date.now() - reasoningStartTime;
          reasoningStartTime = null;
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
      type: 'run_state',
      state: 'done',
      agent: finalAgentType,
    }, traceContext);

    yield withEventMetadata({
      type: 'done',
      fullContent,
      agent: finalAgentType,
      threadId,
    }, traceContext);
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error).slice(0, 500)
          : String(error);
    const classification = classifyError(error) ?? { recoverable: false };

    logger.error('streamMessage failed', {
      runId,
      requestId,
      userId,
      threadId,
      error: errorMessage,
      errorType: typeof error,
      errorConstructor: (error as Record<string, unknown>)?.constructor?.name,
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
  toolNames: Map<string, string>,
): OrchestrationEvent | null {
  switch (event.type) {
    // Raw model streaming - extract text deltas and reasoning events
    case 'raw_model_stream_event': {
      const data = event.data as Record<string, unknown>;
      const dataType = data.type as string | undefined;

      // Text content delta
      if (dataType === 'output_text_delta') {
        const delta = data.delta as string | undefined;
        if (delta) {
          return { type: 'content', delta };
        }
      }

      // Reasoning/thinking events (gpt-5.2 extended thinking)
      if (dataType === 'reasoning_started' || dataType === 'reasoning') {
        return { type: 'reasoning_start' };
      }
      if (dataType === 'reasoning_completed') {
        return { type: 'reasoning_end' };
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
            toolNames.set(callId, toolName);

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

            const toolName = toolNames.get(callId) ?? (raw.name as string | undefined) ?? 'unknown';
            toolNames.delete(callId);

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

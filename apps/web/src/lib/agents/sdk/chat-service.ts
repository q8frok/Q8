import { type OrchestrationEvent, type ExtendedAgentType, type RoutingDecision, type ToolEvent } from '@/lib/agents/orchestration/types';
import { streamMessage as streamMessageSDK, type AgentType } from '@/lib/agents/sdk';
import { classifyError } from '@/lib/agents/sdk/utils/errors';
import type { VersionedEvent } from '@/lib/agents/sdk/events';

export interface ChatServiceRequest {
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
  historyOverride?: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
  requestId?: string;
  correlationId?: string;
}

export interface ChatAgentSelection {
  agent: ExtendedAgentType;
  confidence: number;
  rationale: string;
  source: string;
}

export interface ChatToolSummary {
  total: number;
  succeeded: number;
  failed: number;
  tools: string[];
}

export type ChatFailureClass =
  | 'rate_limit'
  | 'timeout'
  | 'connection'
  | 'auth'
  | 'validation'
  | 'not_found'
  | 'unknown';

export interface ChatFailure {
  class: ChatFailureClass;
  code: string;
  recoverable: boolean;
  message: string;
}

export interface ChatResponseContract {
  agentSelection: ChatAgentSelection;
  toolSummary: ChatToolSummary;
  failure: ChatFailure | null;
}

export interface ChatExecutionResult extends ChatResponseContract {
  content: string;
  agent: ExtendedAgentType;
  threadId: string;
  routing: RoutingDecision;
  toolExecutions?: ToolEvent[];
  memoriesUsed?: Array<{ id: string; content: string; relevance: number }>;
  citations?: Array<{ source: string; url?: string }>;
  metadata?: {
    latency: number;
    tokenUsage?: { input: number; output: number };
    model: string;
  };
}

export class ChatServiceError extends Error {
  constructor(public readonly failure: ChatFailure) {
    super(failure.message);
    this.name = 'ChatServiceError';
  }
}

export function executeChatStream(request: ChatServiceRequest): AsyncGenerator<VersionedEvent<OrchestrationEvent>> {
  return streamMessageSDK({
    ...request,
    forceAgent: request.forceAgent as AgentType | undefined,
  });
}

export async function executeChat(request: ChatServiceRequest): Promise<ChatExecutionResult> {
  let content = '';
  let agent: ExtendedAgentType = request.forceAgent ?? 'orchestrator';
  let threadId = request.threadId ?? '';
  let routing: RoutingDecision = {
    agent,
    confidence: request.forceAgent ? 1 : 0,
    rationale: request.forceAgent ? 'Agent specified by caller' : 'Routing unavailable',
    source: request.forceAgent ? 'heuristic' : 'fallback',
  };

  const toolExecutions: ToolEvent[] = [];

  for await (const event of executeChatStream(request)) {
    switch (event.type) {
      case 'thread_created':
        threadId = event.threadId;
        break;
      case 'routing':
        routing = event.decision;
        agent = event.decision.agent;
        break;
      case 'tool_start':
        toolExecutions.push({
          id: event.id,
          type: 'start',
          tool: event.tool,
          args: event.args,
          timestamp: new Date(),
        });
        break;
      case 'tool_end':
        toolExecutions.push({
          id: event.id,
          type: 'end',
          tool: event.tool,
          result: event.result,
          success: event.success,
          duration: event.duration,
          timestamp: new Date(),
        });
        break;
      case 'content':
        content += event.delta;
        break;
      case 'done':
        content = event.fullContent;
        agent = event.agent;
        threadId = event.threadId;
        break;
      case 'error': {
        const classification = classifyError(event.message);
        throw new ChatServiceError({
          class: toFailureClass(classification.code),
          code: classification.code,
          recoverable: classification.recoverable,
          message: event.message,
        });
      }
      default:
        break;
    }
  }

  const toolEndEvents = toolExecutions.filter((event) => event.type === 'end');
  const failedTools = toolEndEvents.filter((event) => !event.success);

  return {
    content,
    agent,
    threadId,
    routing,
    toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
    agentSelection: {
      agent: routing.agent,
      confidence: routing.confidence,
      rationale: routing.rationale,
      source: routing.source,
    },
    toolSummary: {
      total: toolEndEvents.length,
      succeeded: toolEndEvents.length - failedTools.length,
      failed: failedTools.length,
      tools: [...new Set(toolEndEvents.map((event) => event.tool))],
    },
    failure: null,
  };
}

function toFailureClass(code: string): ChatFailureClass {
  switch (code) {
    case 'RATE_LIMITED':
      return 'rate_limit';
    case 'TIMEOUT':
      return 'timeout';
    case 'CONNECTION_ERROR':
      return 'connection';
    case 'AUTH_ERROR':
      return 'auth';
    case 'VALIDATION_ERROR':
      return 'validation';
    case 'NOT_FOUND':
      return 'not_found';
    default:
      return 'unknown';
  }
}

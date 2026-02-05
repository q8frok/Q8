/**
 * Agent Runner - Core Execution Engine for Agents
 *
 * The agent runner is the heart of the SDK system. It:
 * - Executes agents with streaming output
 * - Handles the tool execution loop
 * - Manages agent-to-agent handoffs
 * - Produces OrchestrationEvent stream compatible with the existing UI
 *
 * This module integrates with:
 * - ./agents - Agent configurations
 * - ./router - Message routing decisions
 * - ./handoffs - Agent-to-agent transfers
 * - ./tools - Tool definitions and execution
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from '@/lib/logger';
import { getModelChain, type ModelConfig } from '../model_factory';
import type { OrchestrationEvent } from '../orchestration/types';
import {
  getAgentConfig,
  getAgentTools,
  type AgentType,
  type AgentConfig,
} from './agents';
import {
  route,
  toOrchestrationRoutingDecision,
  type SDKRoutingDecision,
} from './router';
import {
  executeHandoff,
  decideHandoff,
  type HandoffResult,
} from './handoffs';
import type { ToolDefinition } from './tools/default';
import { classifyError } from './utils/errors';
import { executeWithRetry } from './utils/retry';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Execution context for running an agent
 */
export interface RunContext {
  /** User ID for the current session */
  userId: string;
  /** Optional thread ID for conversation continuity */
  threadId?: string;
  /** User profile for personalization */
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
  };
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  result: unknown;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

/**
 * Options for streamMessage
 */
export interface StreamMessageOptions {
  /** User message to process */
  message: string;
  /** User ID for the session */
  userId: string;
  /** Optional thread ID for conversation continuity */
  threadId?: string;
  /** User profile for personalization */
  userProfile?: RunContext['userProfile'];
  /** Force a specific agent (skip routing) */
  forceAgent?: AgentType;
  /** Include tool execution events in the stream */
  showToolExecutions?: boolean;
  /** Maximum number of tool execution rounds */
  maxToolRounds?: number;
  /** Conversation history to include */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of tool execution rounds before stopping */
const DEFAULT_MAX_TOOL_ROUNDS = 10;

/** Default timeout for tool execution (ms) */
const DEFAULT_TOOL_TIMEOUT_MS = 30000;

/** Tool timeout overrides for specific tools */
const TOOL_TIMEOUTS: Record<string, number> = {
  // GitHub operations can be slow
  github_search_code: 45000,
  github_get_file: 30000,
  github_create_pr: 45000,
  // Weather API is generally fast
  getWeather: 10000,
  // Spotify is fast
  spotify_search: 15000,
  spotify_now_playing: 5000,
};

// =============================================================================
// OPENAI CLIENT CREATION
// =============================================================================

/**
 * Create an OpenAI client for a given model configuration
 */
function createClient(config: ModelConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: 3,
    timeout: 60000,
  });
}

// =============================================================================
// TOOL EXECUTION
// =============================================================================

/**
 * Get timeout for a specific tool
 */
function getToolTimeout(toolName: string): number {
  return TOOL_TIMEOUTS[toolName] ?? DEFAULT_TOOL_TIMEOUT_MS;
}

/**
 * Execute a tool with timeout
 */
async function executeWithTimeout<T>(
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
 * Execute a tool by name with the given arguments
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  agentTools: ToolDefinition[]
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  // Find the tool definition
  const toolDef = agentTools.find((t) => t.name === toolName);
  if (!toolDef) {
    return {
      success: false,
      result: null,
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${toolName}' not found`,
        recoverable: false,
      },
    };
  }

  try {
    // Validate arguments against schema
    const validatedArgs = toolDef.parameters.parse(args);

    // Execute with timeout
    const timeout = getToolTimeout(toolName);
    const result = await executeWithTimeout(
      toolDef.execute(validatedArgs),
      timeout,
      toolName
    );

    const duration = Date.now() - startTime;
    logger.debug('Tool executed successfully', {
      tool: toolName,
      durationMs: duration,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const classification = classifyError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Tool execution failed', {
      tool: toolName,
      error: errorMessage,
      code: classification.code,
      durationMs: duration,
    });

    return {
      success: false,
      result: null,
      error: {
        code: classification.code,
        message: errorMessage,
        recoverable: classification.recoverable,
      },
    };
  }
}

// =============================================================================
// TOOL DEFINITION CONVERSION
// =============================================================================

/**
 * Convert internal ToolDefinition to OpenAI tool format
 */
function toOpenAITools(
  tools: ToolDefinition[]
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }));
}

/**
 * Convert a Zod schema to a JSON Schema (simplified)
 * This is a basic implementation - for production, use zod-to-json-schema
 */
function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Access the internal Zod schema definition
  const zodSchema = schema as { _def?: { typeName?: string; shape?: unknown; properties?: unknown } };

  if (!zodSchema || !zodSchema._def) {
    return { type: 'object', properties: {} };
  }

  const def = zodSchema._def;
  const typeName = def.typeName as string | undefined;

  if (typeName === 'ZodObject') {
    // Handle object schemas
    const shape = (def as { shape?: () => Record<string, unknown> }).shape?.() ?? {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as { _def?: { typeName?: string; description?: string; innerType?: unknown } };
      const fieldDef = fieldSchema._def;

      if (fieldDef) {
        // Check if optional
        const isOptional = fieldDef.typeName === 'ZodOptional' || fieldDef.typeName === 'ZodDefault';
        if (!isOptional) {
          required.push(key);
        }

        // Get the actual type (unwrap optional/default)
        const actualSchema = isOptional
          ? (fieldDef.innerType as { _def?: { typeName?: string; description?: string } })?._def
          : fieldDef;

        const actualTypeName = actualSchema?.typeName;

        // Map Zod types to JSON Schema types
        let jsonType = 'string';
        if (actualTypeName === 'ZodNumber') jsonType = 'number';
        else if (actualTypeName === 'ZodBoolean') jsonType = 'boolean';
        else if (actualTypeName === 'ZodArray') jsonType = 'array';
        else if (actualTypeName === 'ZodEnum') jsonType = 'string';

        properties[key] = {
          type: jsonType,
          ...(fieldDef.description ? { description: fieldDef.description } : {}),
        };
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  // Default fallback
  return { type: 'object', properties: {} };
}

// =============================================================================
// AGENT EXECUTION
// =============================================================================

/**
 * Build the system prompt for an agent
 */
function buildSystemPrompt(
  config: AgentConfig,
  context: RunContext
): string {
  let prompt = config.instructions;

  // Add user context if available
  if (context.userProfile) {
    const { name, timezone, communicationStyle } = context.userProfile;

    if (name) {
      prompt += `\n\nThe user's name is ${name}.`;
    }
    if (timezone) {
      prompt += `\nThe user is in timezone: ${timezone}.`;
    }
    if (communicationStyle === 'concise') {
      prompt += '\nThe user prefers concise, to-the-point responses.';
    } else if (communicationStyle === 'detailed') {
      prompt += '\nThe user prefers detailed, thorough responses.';
    }
  }

  // Add current date/time context
  const now = new Date();
  prompt += `\n\nCurrent date and time: ${now.toISOString()}`;

  return prompt;
}

/**
 * Run an agent with streaming output
 *
 * This is the core execution function that:
 * 1. Calls the LLM with the agent's config
 * 2. Handles tool calls in a loop
 * 3. Yields events for each step
 * 4. Continues until a final response is produced
 */
export async function* runAgent(
  agentType: AgentType,
  message: string,
  context: RunContext,
  options: {
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxToolRounds?: number;
    showToolExecutions?: boolean;
  } = {}
): AsyncGenerator<OrchestrationEvent> {
  const {
    conversationHistory = [],
    maxToolRounds = DEFAULT_MAX_TOOL_ROUNDS,
    showToolExecutions = true,
  } = options;

  const startTime = Date.now();
  const threadId = context.threadId ?? crypto.randomUUID();

  try {
    // Get agent configuration
    const agentConfig = getAgentConfig(agentType);
    const tools = getAgentTools(agentType);

    // Get model configuration
    const modelChain = getModelChain(agentType);
    if (modelChain.length === 0) {
      yield {
        type: 'error',
        message: `No models available for agent: ${agentType}`,
        recoverable: false,
      };
      return;
    }

    const modelConfig = modelChain[0]!;
    if (!modelConfig.apiKey) {
      yield {
        type: 'error',
        message: `API key not configured for ${agentType}`,
        recoverable: false,
      };
      return;
    }

    // Yield agent start event
    yield { type: 'agent_start', agent: agentType };

    // Build messages
    const systemPrompt = buildSystemPrompt(agentConfig, context);
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Create OpenAI client
    const client = createClient(modelConfig);

    // Convert tools to OpenAI format
    const openaiTools = tools.length > 0 ? toOpenAITools(tools) : undefined;

    // Tool execution loop
    let toolRound = 0;
    let fullContent = '';

    while (toolRound < maxToolRounds) {
      toolRound++;

      logger.debug('Agent execution round', {
        agent: agentType,
        round: toolRound,
        messageCount: messages.length,
        hasTools: !!openaiTools,
      });

      // Make LLM call
      const completion = await executeWithRetry(
        async () => {
          const isXai = modelConfig.model.toLowerCase().includes('grok');
          const maxTokensKey = isXai ? 'max_tokens' : 'max_completion_tokens';

          return client.chat.completions.create({
            model: modelConfig.model,
            messages,
            ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools, tool_choice: 'auto' } : {}),
            [maxTokensKey]: agentConfig.modelOptions?.maxTokens ?? 2000,
            temperature: agentConfig.modelOptions?.temperature ?? 0.7,
            stream: false,
          });
        },
        {
          maxRetries: 3,
          backoffMs: 1000,
          maxBackoffMs: 10000,
        }
      );

      const assistantMessage = completion.choices[0]?.message;
      if (!assistantMessage) {
        yield {
          type: 'error',
          message: 'No response from LLM',
          recoverable: true,
        };
        return;
      }

      const toolCalls = assistantMessage.tool_calls;

      // If no tool calls, we have a final response
      if (!toolCalls || toolCalls.length === 0) {
        fullContent = assistantMessage.content ?? '';

        // Stream the content as a single delta (non-streaming mode)
        if (fullContent) {
          yield { type: 'content', delta: fullContent };
        }
        break;
      }

      // Process tool calls
      const toolMessages: ChatCompletionMessageParam[] = [];

      // Parse tool calls first and emit start events
      const parsedToolCalls = toolCalls.map((toolCall) => {
        const functionName = toolCall.function.name;
        let functionArgs: Record<string, unknown>;

        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          functionArgs = {};
        }

        return {
          toolCall,
          functionName,
          functionArgs,
          callId: toolCall.id,
        };
      });

      // Emit tool_start events before parallel execution
      if (showToolExecutions) {
        for (const { functionName, functionArgs, callId } of parsedToolCalls) {
          yield {
            type: 'tool_start',
            tool: functionName,
            args: functionArgs,
            id: callId,
          };
        }
      }

      // Execute tools in parallel
      const toolResults = await Promise.all(
        parsedToolCalls.map(async ({ toolCall, functionName, functionArgs, callId }) => {
          const callStartTime = Date.now();

          // Execute the tool
          const result = await executeTool(functionName, functionArgs, tools);
          const duration = Date.now() - callStartTime;

          return {
            toolCall,
            functionName,
            callId,
            result,
            duration,
          };
        })
      );

      // Emit tool_end events after parallel execution
      if (showToolExecutions) {
        for (const { functionName, callId, result, duration } of toolResults) {
          yield {
            type: 'tool_end',
            tool: functionName,
            success: result.success,
            result: result.result,
            id: callId,
            duration,
          };
        }
      }

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: toolCalls,
      });

      // Add tool results to messages
      for (const { toolCall, result } of toolResults) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      messages.push(...toolMessages);
    }

    // Check for max rounds exceeded
    if (toolRound >= maxToolRounds && !fullContent) {
      fullContent = 'I apologize, but I exceeded the maximum number of tool calls. Please try a simpler request.';
      yield { type: 'content', delta: fullContent };
    }

    const duration = Date.now() - startTime;
    logger.info('Agent execution completed', {
      agent: agentType,
      durationMs: duration,
      toolRounds: toolRound,
      contentLength: fullContent.length,
    });

    // Yield done event
    yield {
      type: 'done',
      fullContent,
      agent: agentType,
      threadId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const classification = classifyError(error);

    logger.error('Agent execution failed', {
      agent: agentType,
      error: errorMessage,
      code: classification.code,
    });

    yield {
      type: 'error',
      message: errorMessage,
      recoverable: classification.recoverable,
    };
  }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Stream a message through the orchestration system
 *
 * This is the main entry point that:
 * 1. Routes the message to the appropriate agent (or uses forceAgent)
 * 2. Runs the selected agent
 * 3. Handles handoffs if the agent requests one
 * 4. Yields all events to the caller
 */
export async function* streamMessage(
  options: StreamMessageOptions
): AsyncGenerator<OrchestrationEvent> {
  const {
    message,
    userId,
    threadId: providedThreadId,
    userProfile,
    forceAgent,
    showToolExecutions = true,
    maxToolRounds = DEFAULT_MAX_TOOL_ROUNDS,
    conversationHistory = [],
  } = options;

  const threadId = providedThreadId ?? crypto.randomUUID();
  const context: RunContext = {
    userId,
    threadId,
    userProfile,
  };

  // If no thread was provided, emit thread_created event
  if (!providedThreadId) {
    yield { type: 'thread_created', threadId };
  }

  try {
    // Step 1: Route the message (or use forced agent)
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

    // Yield routing event (convert to orchestration format)
    yield {
      type: 'routing',
      decision: toOrchestrationRoutingDecision(routingDecision),
    };

    let currentAgent = routingDecision.agent;
    const currentMessage = message;
    let handoffCount = 0;
    const maxHandoffs = 3; // Prevent infinite handoff loops

    // Step 2: Run agents with handoff support
    while (handoffCount <= maxHandoffs) {
      // Run the current agent
      const agentGenerator = runAgent(currentAgent, currentMessage, context, {
        conversationHistory,
        maxToolRounds,
        showToolExecutions,
      });

      let lastDoneEvent: OrchestrationEvent | null = null;

      // Yield events from the agent
      for await (const event of agentGenerator) {
        // Capture the done event but don't yield it yet
        // (we might need to handoff)
        if (event.type === 'done') {
          lastDoneEvent = event;
        } else {
          yield event;
        }
      }

      // If we have a final response, check for handoff decision
      if (lastDoneEvent && lastDoneEvent.type === 'done') {
        // Check if a handoff is needed based on the response
        const handoffDecision = await decideHandoff(
          lastDoneEvent.fullContent,
          currentAgent
        );

        if (handoffDecision.shouldHandoff && handoffDecision.handoff) {
          // Don't exceed max handoffs
          if (handoffCount >= maxHandoffs) {
            logger.warn('Max handoffs reached, stopping', {
              handoffCount,
              currentAgent,
              targetAgent: handoffDecision.handoff.targetAgent,
            });
            yield lastDoneEvent;
            return;
          }

          // Execute the handoff
          const handoffResult: HandoffResult = await executeHandoff(
            handoffDecision.handoff,
            currentMessage,
            userId,
            threadId
          );

          if (handoffResult.success) {
            // Yield handoff event
            yield {
              type: 'handoff',
              from: currentAgent,
              to: handoffResult.targetAgent,
              reason: handoffDecision.handoff.reason,
            };

            // Update for next iteration
            currentAgent = handoffResult.targetAgent;
            // Keep the same message for the new agent
            handoffCount++;
            continue;
          } else {
            // Handoff failed, return the original response
            logger.warn('Handoff execution failed', {
              error: handoffResult.error,
              targetAgent: handoffResult.targetAgent,
            });
            yield lastDoneEvent;
            return;
          }
        } else {
          // No handoff needed, yield the done event
          yield lastDoneEvent;
          return;
        }
      }

      // If we got here without a done event, something went wrong
      yield {
        type: 'error',
        message: 'Agent execution completed without a response',
        recoverable: true,
      };
      return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const classification = classifyError(error);

    logger.error('streamMessage failed', {
      userId,
      threadId,
      error: errorMessage,
    });

    yield {
      type: 'error',
      message: errorMessage,
      recoverable: classification.recoverable,
    };
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export { toOpenAITools, buildSystemPrompt };

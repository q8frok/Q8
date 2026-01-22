/**
 * Unified Orchestration Service
 * Single entry point for both streaming and non-streaming chat flows
 * Consolidates routing, tool orchestration, and response generation
 */

// Imports updated to use new modules
import { getModel, type AgentType } from '../model_factory';
import { buildEnrichedContext } from '../context-provider';
import { addMessage, getConversationHistory } from '../conversation-store';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { ChatMessageInsert } from '@/lib/supabase/types';
import type { EnrichedContext } from '../types';

import {
  buildSystemPrompt,
  fetchMemoryContext,
  getDocumentContext,
} from './context-builder';
import {
  getAgentTools,
  executeAgentTool,
} from './agent-runner';
import type {
  ExtendedAgentType,
  RoutingDecision,
  OrchestrationRequest,
  OrchestrationResponse,
  OrchestrationEvent,
  ToolEvent,
} from './types';
import { route } from './router';
import { logRoutingTelemetry, recordImplicitFeedback } from './metrics';
import { getConversationContext } from '@/lib/documents/processor';


/**
 * Agent system prompts
 */


/**
 * Build complete system prompt for an agent with context
 */




// =============================================================================
// TOOL EXECUTION WITH TIMEOUTS AND ERROR BOUNDARIES
// =============================================================================

/**
 * Per-tool timeout configuration (in milliseconds)
 * Tools that call external APIs get longer timeouts
 */


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
 * Execute a tool for an agent with timeout and error boundaries
 * All tool executors return ToolResult for consistent handling
 */




/**
 * Process a message through the orchestration system (non-streaming)
 */
export async function processMessage(
  request: OrchestrationRequest
): Promise<OrchestrationResponse> {
  const startTime = Date.now();
  const { message, userId, threadId: providedThreadId, userProfile, forceAgent } = request;

  try {
    // Get or create thread
    let threadId: string;
    if (providedThreadId) {
      threadId = providedThreadId;
    } else {
      const { data: newThread, error } = await supabaseAdmin
        .from('threads')
        .insert({ user_id: userId })
        .select()
        .single();

      if (error || !newThread) {
        throw new Error('Failed to create thread');
      }
      threadId = newThread.id;
    }

    // Build context
    const sessionId = threadId;
    const context = await buildEnrichedContext(
      userId,
      sessionId,
      userProfile ? {
        name: userProfile.name,
        timezone: userProfile.timezone,
        communicationStyle: userProfile.communicationStyle,
        preferences: {},
      } : undefined
    );

    // Add user message to history
    addMessage(sessionId, 'user', message);

    // Save user message to Supabase
    await supabaseAdmin.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'user',
      content: message,
    } as ChatMessageInsert);

    // Route the message
    let routingDecision: RoutingDecision;
    if (forceAgent) {
      routingDecision = {
        agent: forceAgent,
        confidence: 1,
        rationale: 'User-specified agent',
        source: 'heuristic',
      };
    } else {
      routingDecision = await route(message);
    }

    const targetAgent = routingDecision.agent as AgentType;

    // Get model configuration (finance has its own model in model_factory)
    const modelConfig = getModel(targetAgent);

    if (!modelConfig.apiKey) {
      throw new Error(`API key not configured for ${targetAgent}`);
    }

    // Build system prompt with memory and document context
    const memoryContext = await fetchMemoryContext(userId);

    // Fetch relevant document context for the query
    let documentContext = '';
    try {
      const docContext = await getConversationContext(userId, threadId, message, 4000);
      if (docContext.content) {
        documentContext = docContext.content;
        logger.debug('Document context retrieved', {
          userId,
          threadId,
          sourceCount: docContext.sources.length,
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch document context', { userId, threadId, error });
    }

    const systemPrompt = await buildSystemPrompt(routingDecision.agent, context, memoryContext, documentContext);

    // Get conversation history
    const { data: dbMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (dbMessages || [])
      .filter((m: { role: string }) => m.role !== 'system')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    // Get tools for agent
    const tools = getAgentTools(routingDecision.agent);

    // Initialize OpenAI client
    const { OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: modelConfig.apiKey,
      baseURL: modelConfig.baseURL,
    });

    // Execute completion with optional tools
    const toolExecutions: ToolEvent[] = [];
    let responseContent: string;

    if (tools.length > 0) {
      // Agent with tools
      const completion = await client.chat.completions.create({
        model: modelConfig.model,
        messages,
        tools,
        tool_choice: 'auto',
        max_completion_tokens: 1000,
      });

      const assistantMessage = completion.choices[0]?.message;
      const toolCalls = assistantMessage?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Execute tools
        const toolMessages: Array<{ role: 'tool'; tool_call_id: string; content: string }> = [];

        for (const toolCall of toolCalls) {
          const toolStartTime = Date.now();
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          const result = await executeAgentTool(
            routingDecision.agent,
            functionName,
            functionArgs,
            userId
          );

          const duration = Date.now() - toolStartTime;

          toolExecutions.push({
            id: toolCall.id,
            type: 'end',
            tool: functionName,
            args: functionArgs,
            result: result.data,
            success: result.success,
            duration,
            timestamp: new Date(),
          });

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Get final response with tool results
        const followUp = await client.chat.completions.create({
          model: modelConfig.model,
          messages: [
            ...messages,
            { role: 'assistant', content: null, tool_calls: toolCalls },
            ...toolMessages,
          ] as Parameters<typeof client.chat.completions.create>[0]['messages'],
          max_completion_tokens: 1000,
        });

        responseContent = followUp.choices[0]?.message?.content ||
          'I executed the requested actions.';
      } else {
        responseContent = assistantMessage?.content ||
          'I need more information to help with that.';
      }
    } else {
      // Standard completion without tools
      const isOpenAIReasoningModel = !modelConfig.baseURL || modelConfig.baseURL.includes('openai.com');

      const completion = await client.chat.completions.create({
        model: modelConfig.model,
        messages,
        ...(isOpenAIReasoningModel
          ? { max_completion_tokens: 1000 }
          : { max_tokens: 1000, temperature: 0.7 }),
      });

      responseContent = completion.choices[0]?.message?.content ||
        'Sorry, I received an empty response. Please try again.';
    }

    // Save assistant response
    addMessage(sessionId, 'assistant', responseContent, routingDecision.agent);

    await supabaseAdmin.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'assistant',
      content: responseContent,
      agent_name: routingDecision.agent,
    } as ChatMessageInsert);

    // Log telemetry
    const latency = Date.now() - startTime;
    await logRoutingTelemetry({
      userId,
      threadId,
      selectedAgent: routingDecision.agent,
      routingSource: routingDecision.source,
      confidence: routingDecision.confidence,
      latencyMs: latency,
      success: true,
      toolsUsed: toolExecutions.map((t) => t.tool),
      fallbackUsed: routingDecision.source === 'fallback',
    });

    return {
      content: responseContent,
      agent: routingDecision.agent,
      threadId,
      routing: routingDecision,
      toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
      metadata: {
        latency,
        model: modelConfig.model,
      },
    };
  } catch (error) {
    logger.error('Orchestration error', { userId, threadId: providedThreadId, error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure
    if (providedThreadId) {
      await recordImplicitFeedback(userId, providedThreadId, 'personality', 'tool_failure');
    }

    throw error;
  }
}

/**
 * Create a streaming orchestration generator
 * Returns an async generator of OrchestrationEvents
 */
export async function* streamMessage(
  request: OrchestrationRequest
): AsyncGenerator<OrchestrationEvent> {
  const startTime = Date.now();
  const { message, userId, threadId: providedThreadId, userProfile, forceAgent, showToolExecutions = true } = request;

  try {
    // Get or create thread
    let threadId: string;
    if (providedThreadId) {
      threadId = providedThreadId;
    } else {
      const { data: newThread, error } = await supabaseAdmin
        .from('threads')
        .insert({ user_id: userId })
        .select()
        .single();

      if (error || !newThread) {
        yield { type: 'error', message: 'Failed to create thread', recoverable: false };
        return;
      }
      threadId = newThread.id;
      yield { type: 'thread_created', threadId };
    }

    // Build context
    const sessionId = threadId;
    const context = await buildEnrichedContext(
      userId,
      sessionId,
      userProfile ? {
        name: userProfile.name,
        timezone: userProfile.timezone,
        communicationStyle: userProfile.communicationStyle,
        preferences: {},
      } : undefined
    );

    // Add user message
    addMessage(sessionId, 'user', message);

    await supabaseAdmin.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'user',
      content: message,
    } as ChatMessageInsert);

    // Route the message
    let routingDecision: RoutingDecision;
    if (forceAgent) {
      routingDecision = {
        agent: forceAgent,
        confidence: 1,
        rationale: 'User-specified agent',
        source: 'heuristic',
      };
    } else {
      routingDecision = await route(message);
    }

    yield { type: 'routing', decision: routingDecision };
    yield { type: 'agent_start', agent: routingDecision.agent };

    const targetAgent = routingDecision.agent as AgentType;
    const modelConfig = getModel(targetAgent);

    if (!modelConfig.apiKey) {
      yield { type: 'error', message: `API key not configured for ${targetAgent}`, recoverable: false };
      return;
    }

    // Build system prompt with memory and document context
    const memoryContext = await fetchMemoryContext(userId);

    // Fetch relevant document context for the query
    let documentContext = '';
    try {
      const docContext = await getConversationContext(userId, threadId, message, 4000);
      if (docContext.content) {
        documentContext = docContext.content;
        logger.debug('Document context retrieved for streaming', {
          userId,
          threadId,
          sourceCount: docContext.sources.length,
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch document context', { userId, threadId, error });
    }

    const systemPrompt = await buildSystemPrompt(routingDecision.agent, context, memoryContext, documentContext);

    // Get conversation history
    const { data: dbMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (dbMessages || [])
      .filter((m: { role: string }) => m.role !== 'system')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    // Initialize OpenAI
    const { OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: modelConfig.apiKey,
      baseURL: modelConfig.baseURL,
    });

    // Get tools
    const tools = getAgentTools(routingDecision.agent);
    const toolExecutions: ToolEvent[] = [];
    let fullContent = '';

    if (tools.length > 0) {
      // Tool-using agent
      const completion = await client.chat.completions.create({
        model: modelConfig.model,
        messages,
        tools,
        tool_choice: 'auto',
        max_completion_tokens: 1000,
      });

      const assistantMessage = completion.choices[0]?.message;
      const toolCalls = assistantMessage?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const toolMessages: Array<{ role: 'tool'; tool_call_id: string; content: string }> = [];

        for (const toolCall of toolCalls) {
          const toolId = toolCall.id;
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const toolStartTime = Date.now();

          if (showToolExecutions) {
            yield { type: 'tool_start', tool: functionName, args: functionArgs, id: toolId };
          }

          const result = await executeAgentTool(
            routingDecision.agent,
            functionName,
            functionArgs,
            userId
          );

          const duration = Date.now() - toolStartTime;

          toolExecutions.push({
            id: toolId,
            type: 'end',
            tool: functionName,
            args: functionArgs,
            result: result.data,
            success: result.success,
            duration,
            timestamp: new Date(),
          });

          if (showToolExecutions) {
            yield {
              type: 'tool_end',
              tool: functionName,
              success: result.success,
              result: result.data || result.message,
              id: toolId,
              duration,
            };
          }

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Stream follow-up response
        const followUpStream = await client.chat.completions.create({
          model: modelConfig.model,
          messages: [
            ...messages,
            { role: 'assistant', content: null, tool_calls: toolCalls },
            ...toolMessages,
          ] as Parameters<typeof client.chat.completions.create>[0]['messages'],
          stream: true,
          max_completion_tokens: 1000,
        });

        for await (const chunk of followUpStream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            yield { type: 'content', delta };
          }
        }
      } else if (assistantMessage?.content) {
        // No tools called, just content
        fullContent = assistantMessage.content;
        // Simulate streaming for consistency
        const words = fullContent.split(' ');
        for (const word of words) {
          yield { type: 'content', delta: word + ' ' };
        }
      }
    } else {
      // Standard streaming completion
      const stream = await client.chat.completions.create({
        model: modelConfig.model,
        messages,
        stream: true,
        max_tokens: 1000,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          yield { type: 'content', delta };
        }
      }
    }

    // Ensure we have content
    if (!fullContent) {
      fullContent = 'I apologize, but I couldn\'t generate a response. Please try again.';
      yield { type: 'content', delta: fullContent };
    }

    // Save response
    addMessage(sessionId, 'assistant', fullContent, routingDecision.agent);

    await supabaseAdmin.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'assistant',
      content: fullContent,
      agent_name: routingDecision.agent,
    } as ChatMessageInsert);

    // Log telemetry
    const latency = Date.now() - startTime;
    await logRoutingTelemetry({
      userId,
      threadId,
      selectedAgent: routingDecision.agent,
      routingSource: routingDecision.source,
      confidence: routingDecision.confidence,
      latencyMs: latency,
      success: true,
      toolsUsed: toolExecutions.map((t) => t.tool),
      fallbackUsed: routingDecision.source === 'fallback',
    });

    // Trigger async memory extraction
    extractMemoriesAsync(userId, threadId, message, fullContent);

    yield { type: 'done', fullContent, agent: routingDecision.agent, threadId };
  } catch (error) {
    logger.error('Orchestration streaming error', { userId, threadId: providedThreadId, error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    yield { type: 'error', message: errorMessage, recoverable: true };
  }
}

/**
 * Extract memories asynchronously (fire and forget)
 */
function extractMemoriesAsync(userId: string, threadId: string, userMessage: string, assistantMessage: string) {
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/memories/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, threadId, userMessage, assistantMessage }),
  }).catch((err) => logger.warn('Memory extraction failed', { userId, threadId, error: err }));
}

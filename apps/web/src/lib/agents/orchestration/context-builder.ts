import { type AgentType } from '../model_factory';
import { type ExtendedAgentType } from './types';
import { buildEnrichedContext, buildContextSummary, getGreeting } from '../context-provider';
import { buildDeviceSummary } from '../home-context';
import { getFinancialContext } from '../sub-agents/finance-advisor';
import { getHomeBioRhythmContext } from '../sub-agents/home';
import { AGENT_PROMPTS } from './constants';
import type { EnrichedContext } from '../types';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getConversationContext } from '@/lib/documents/processor';
import { getUserContext, buildUserContextPrompt } from './user-context';
import { analyzeVibe, buildVibeContextPrompt } from './vibe-check';

/**
 * Fetch relevant memories for context
 */
export async function fetchMemoryContext(userId: string): Promise<string> {
  try {
    const { data: memories } = await supabaseAdmin
      .from('agent_memories')
      .select('content, memory_type, importance')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (memories && memories.length > 0) {
      return '\n\n## User Context (from memory)\n' +
        memories.map((m: { content: string; memory_type: string }) =>
          `- [${m.memory_type}] ${m.content}`
        ).join('\n');
    }
  } catch (error) {
    logger.warn('Failed to fetch memories', { userId, error });
  }
  return '';
}

/**
 * Build complete system prompt for an agent with context
 */
export async function buildSystemPrompt(
  agent: ExtendedAgentType,
  context: EnrichedContext,
  memoryContext: string = '',
  documentContext: string = ''
): Promise<string> {
  const basePrompt = AGENT_PROMPTS[agent] || AGENT_PROMPTS.personality;
  const contextBlock = buildContextSummary(context);
  const greeting = getGreeting(context.timeOfDay);

  let prompt = `${basePrompt}

${greeting}!

${contextBlock}`;

  // Add user context from The Memex (preferences, habits, bio-rhythm, etc.)
  try {
    const userContext = await getUserContext(context.userId);
    const userContextPrompt = buildUserContextPrompt(userContext);
    if (userContextPrompt) {
      prompt += `\n\n${userContextPrompt}`;
    }
  } catch (error) {
    logger.warn('Failed to fetch user context for prompt', { userId: context.userId, error });
  }

  // Add vibe check for personality-aware agents
  if (agent === 'personality' || agent === 'orchestrator') {
    try {
      const vibeState = await analyzeVibe(context.userId);
      const vibePrompt = buildVibeContextPrompt(vibeState);
      if (vibePrompt) {
        prompt += `\n\n${vibePrompt}`;
      }
    } catch (error) {
      logger.warn('Failed to analyze vibe for prompt', { userId: context.userId, error });
    }
  }

  // Add agent-specific context
  if (agent === 'home') {
    const [deviceSummary, bioRhythmContext] = await Promise.all([
      buildDeviceSummary(),
      getHomeBioRhythmContext(context.userId),
    ]);
    prompt += `\n\n${deviceSummary}`;
    if (bioRhythmContext) {
      prompt += `\n\n${bioRhythmContext}`;
    }
  }

  if (agent === 'finance') {
    const financialContext = await getFinancialContext(context.userId);
    prompt += `\n\n${financialContext}`;
  }

  // Add memory context if available
  if (memoryContext) {
    prompt += `\n\n${memoryContext}`;
  }

  // Add document context if available (from uploaded documents/knowledge base)
  if (documentContext) {
    prompt += `\n\n## Relevant Documents\nThe following content is from the user's uploaded documents and knowledge base. Use this information to provide more accurate and contextual responses:\n\n${documentContext}`;
  }

  return prompt;
}

export async function getDocumentContext(userId: string, threadId: string, message: string): Promise<string> {
  try {
    const docContext = await getConversationContext(userId, threadId, message, 4000);
    if (docContext.content) {
      logger.debug('Document context retrieved', {
        userId,
        threadId,
        sourceCount: docContext.sources.length,
      });
      return docContext.content;
    }
  } catch (error) {
    logger.warn('Failed to fetch document context', { userId, threadId, error });
  }
  return '';
}

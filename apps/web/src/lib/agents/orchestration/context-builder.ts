import { type AgentType } from '../model_factory';
import { type ExtendedAgentType } from './types';
import { buildEnrichedContext, buildContextSummary, getGreeting } from '../context-provider';
import { buildDeviceSummary } from '../home-context';
import { getFinancialContext } from '../sub-agents/finance-advisor';
import { AGENT_PROMPTS } from './constants';
import type { EnrichedContext } from '../types';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getConversationContext } from '@/lib/documents/processor';

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

  // Add agent-specific context
  if (agent === 'home') {
    const deviceSummary = await buildDeviceSummary();
    prompt += `\n\n${deviceSummary}`;
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

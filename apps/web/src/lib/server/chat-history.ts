import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface CanonicalConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function fetchThreadMessages(threadId: string, messageLimit = 100) {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(messageLimit);

  if (error) {
    logger.error('[Chat History] Failed to fetch thread messages', {
      threadId,
      messageLimit,
      error,
    });
    return [];
  }

  return data ?? [];
}

export async function fetchCanonicalConversationHistory(
  threadId: string,
  messageLimit = 100,
): Promise<CanonicalConversationMessage[]> {
  const messages = await fetchThreadMessages(threadId, messageLimit);

  return messages
    .filter((message): message is { role: 'user' | 'assistant'; content: string } =>
      (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string',
    )
    .map(message => ({
      role: message.role,
      content: message.content,
    }));
}

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getAgentModel } from '@/lib/agents/sdk/model-provider';

// TODO: Phase 4 — Migrate finance chat to SDK finance agent with proper tool execution.
// This is a simplified direct-call version that replaces the legacy gemini-based sub-agent.

/**
 * POST /api/finance/ai/chat
 * Handle finance-related chat messages with AI for authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }
    const userId = user.id;

    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return errorResponse('Message required', 400);
    }

    const client = new OpenAI();
    const model = getAgentModel('finance');

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system' as const,
          content: 'You are a helpful financial advisor assistant. Answer questions about personal finance, budgeting, spending, and investments clearly and concisely.',
        },
        ...conversationHistory.slice(-10).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || 'I was unable to generate a response.';

    await storeConversation(userId, message, content);

    return NextResponse.json({
      response: content,
      toolsUsed: [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Finance chat error', { error });
    return errorResponse('Failed to process chat message', 500);
  }
}

/**
 * Store conversation in the database
 */
async function storeConversation(
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  try {
    // Check if table exists and insert
    const { error } = await supabase.from('finance_chat_history').insert({
      user_id: userId,
      user_message: userMessage,
      assistant_response: assistantResponse,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Table might not exist yet, log but don't fail
      logger.warn('Could not store chat history', { message: error.message });
    }
  } catch (err) {
    // Non-critical, just log
    logger.warn('Chat history storage error', { err });
  }
}

/**
 * GET /api/finance/ai/chat
 * Get chat history for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data, error } = await supabase
      .from('finance_chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Table might not exist
      logger.warn('Could not fetch chat history', { message: error.message });
      return NextResponse.json({ history: [], count: 0 });
    }

    // Transform to conversation format
    const history = (data || []).map((item) => ({
      id: item.id,
      userMessage: item.user_message,
      assistantResponse: item.assistant_response,
      createdAt: item.created_at,
    }));

    return NextResponse.json({
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error('Chat history fetch error', { error });
    return errorResponse('Failed to fetch chat history', 500);
  }
}

/**
 * Memory Extract API Route
 * POST - Extract memories from conversation and update user context
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';
import type { MemoryType, MemoryImportance, AgentMemoryInsert } from '@/lib/supabase/types';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { logger } from '@/lib/logger';
import { extractUserContext } from '@/lib/agents/orchestration/user-context';

export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedMemory {
  content: string;
  memory_type: MemoryType;
  importance: MemoryImportance;
  tags: string[];
}

/**
 * POST /api/memories/extract
 * Extract memories from a message or conversation
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const {
      threadId,
      userMessage,
      assistantMessage,
    } = body as {
      threadId: string;
      userMessage: string;
      assistantMessage: string;
    };

    const userId = user.id; // Use authenticated user

    if (!userMessage) {
      return errorResponse('userMessage is required', 400);
    }

    // Use GPT to extract memories from the conversation
    const extractionPrompt = `Analyze this conversation and extract any important information that should be remembered about the user for future conversations.

User message: "${userMessage}"
${assistantMessage ? `Assistant response: "${assistantMessage}"` : ''}

Extract ONLY information that reveals:
- **Facts**: Personal facts about the user (name, job, location, birthday, etc.)
- **Preferences**: Things the user likes, dislikes, or prefers
- **Tasks**: Things the user wants to remember or do
- **Events**: Upcoming events, appointments, or deadlines mentioned
- **Relationships**: People the user mentions and their relation

Rules:
- Only extract if there's clear, factual information
- Don't invent or assume information
- Each memory should be a single, clear statement
- Return an empty array if nothing worth remembering

Return a JSON array of memories:
[
  {
    "content": "The specific fact or preference",
    "memory_type": "fact|preference|task|event|relationship",
    "importance": "low|medium|high|critical",
    "tags": ["relevant", "tags"]
  }
]

Return ONLY valid JSON, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You extract structured information from conversations. Return only valid JSON arrays.',
        },
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{"memories":[]}';
    
    let extractedMemories: ExtractedMemory[] = [];
    try {
      const parsed = JSON.parse(responseText);
      extractedMemories = Array.isArray(parsed) ? parsed : (parsed.memories || []);
    } catch {
      logger.warn('[Memory Extract] Failed to parse AI response', { responseText: responseText });
      return NextResponse.json({ memories: [], extracted: 0 });
    }

    if (extractedMemories.length === 0) {
      return NextResponse.json({ memories: [], extracted: 0 });
    }

    // Check for duplicates before inserting
    const existingMemories = await supabaseAdmin
      .from('agent_memories')
      .select('content')
      .eq('user_id', userId);

    const existingContents = new Set(
      (existingMemories.data || []).map((m: { content: string }) => m.content.toLowerCase())
    );

    // Filter out duplicates (simple string matching)
    const newMemories = extractedMemories.filter(
      (m) => !existingContents.has(m.content.toLowerCase())
    );

    if (newMemories.length === 0) {
      return NextResponse.json({ memories: [], extracted: 0, message: 'All memories already exist' });
    }

    // Generate embeddings for new memories
    const memoriesWithEmbeddings = await Promise.all(
      newMemories.map(async (memory) => {
        try {
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: memory.content,
          });
          return {
            ...memory,
            embedding: embeddingResponse.data[0]?.embedding || null,
          };
        } catch {
          return { ...memory, embedding: null };
        }
      })
    );

    // Insert memories
    const memoriesToInsert: AgentMemoryInsert[] = memoriesWithEmbeddings.map((m) => ({
      user_id: userId,
      content: m.content,
      memory_type: m.memory_type,
      importance: m.importance,
      source_thread_id: threadId,
      tags: m.tags,
      embedding: m.embedding,
    }));

    const { data: insertedMemories, error } = await supabaseAdmin
      .from('agent_memories')
      .insert(memoriesToInsert)
      .select();

    if (error) {
      logger.error('[Memory Extract] Error inserting memories', { error: error });
      return errorResponse('Failed to save memories', 500);
    }

    // Also extract and save to user context (The Memex)
    try {
      await extractUserContext(
        userId,
        threadId,
        newMemories.map((m) => ({
          content: m.content,
          memory_type: m.memory_type,
          tags: m.tags,
        })),
        'memory_extractor'
      );
      logger.debug('[Memory Extract] User context updated', { userId, count: newMemories.length });
    } catch (contextError) {
      // Don't fail the whole request if context extraction fails
      logger.warn('[Memory Extract] Failed to update user context', { userId, error: contextError });
    }

    return NextResponse.json({
      memories: insertedMemories,
      extracted: insertedMemories?.length || 0,
    });
  } catch (error) {
    logger.error('[Memory Extract API] Error', { error: error });
    return errorResponse('Internal server error', 500);
  }
}

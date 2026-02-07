import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAgentModel } from '@/lib/agents/sdk/model-provider';
import { errorResponse } from '@/lib/api/error-responses';
import { logger } from '@/lib/logger';

type NoteAIOperation =
  | 'summarize'
  | 'expand'
  | 'rewrite-formal'
  | 'rewrite-casual'
  | 'extract-tasks';

const VALID_OPERATIONS: NoteAIOperation[] = [
  'summarize',
  'expand',
  'rewrite-formal',
  'rewrite-casual',
  'extract-tasks',
];

const OPERATION_PROMPTS: Record<NoteAIOperation, string> = {
  summarize:
    'Summarize the following note concisely, preserving key points and action items. Return only the summary, no preamble.',
  expand:
    'Expand on the following note with more detail, examples, and context. Maintain the original structure and tone. Return only the expanded content.',
  'rewrite-formal':
    'Rewrite the following note in a formal, professional tone. Maintain all the information. Return only the rewritten content.',
  'rewrite-casual':
    'Rewrite the following note in a casual, conversational tone. Maintain all the information. Return only the rewritten content.',
  'extract-tasks':
    'Extract all actionable tasks from the following note. Return them as a markdown checklist (- [ ] task). If no tasks found, return "No actionable tasks found."',
};

export async function POST(request: NextRequest) {
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { content, operation } = body;

    if (!content || typeof content !== 'string') {
      return errorResponse('Content is required', 400, 'VALIDATION_ERROR');
    }

    if (!operation || !VALID_OPERATIONS.includes(operation)) {
      return errorResponse(
        `Invalid operation. Must be one of: ${VALID_OPERATIONS.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    const model = getAgentModel('secretary');
    const client = new OpenAI();

    const systemPrompt = OPERATION_PROMPTS[operation as NoteAIOperation];

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: 2048,
      temperature: operation === 'extract-tasks' ? 0.2 : 0.7,
    });

    const result = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ result, operation });
  } catch (error) {
    logger.error('Notes AI assist failed', { error, userId: user.id });
    return errorResponse('AI processing failed', 500, 'AI_ERROR');
  }
}

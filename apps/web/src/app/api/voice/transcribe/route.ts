/**
 * Voice Transcription API Route
 * Uses OpenAI Whisper for speech-to-text
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob;
    const language = formData.get('language') as string || 'en';

    if (!audioFile) {
      return errorResponse('No audio file provided', 400);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return errorResponse('OpenAI API key not configured', 500);
    }

    // Prepare form data for OpenAI
    const openAIFormData = new FormData();
    openAIFormData.append('file', audioFile, 'audio.webm');
    openAIFormData.append('model', 'whisper-1');
    openAIFormData.append('language', language);
    openAIFormData.append('response_format', 'json');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: openAIFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Transcribe] OpenAI error', { errorText: errorText });
      return errorResponse(`Transcription failed: ${response.status}`, response.status);
    }

    const result = await response.json();

    return NextResponse.json({
      text: result.text,
      language: language,
    });
  } catch (error) {
    logger.error('[Transcribe] Error', { error: error });
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return errorResponse(message, 500);
  }
}

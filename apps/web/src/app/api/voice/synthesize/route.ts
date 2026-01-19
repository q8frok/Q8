/**
 * Voice Synthesis API Route
 * Uses OpenAI TTS for text-to-speech
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { synthesizeSchema, validationErrorResponse } from '@/lib/validations';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate input
    const parseResult = synthesizeSchema.safeParse(body);
    if (!parseResult.success) {
      return validationErrorResponse(parseResult.error);
    }

    const { text, voice, speed } = parseResult.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        speed: Math.max(0.25, Math.min(4.0, speed)), // Clamp speed between 0.25 and 4.0
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Synthesize] OpenAI error', { errorText: errorText });
      return NextResponse.json(
        { error: `Speech synthesis failed: ${response.status}` },
        { status: response.status }
      );
    }

    // Return audio as blob
    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    logger.error('[Synthesize] Error', { error: error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to list available voices
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  return NextResponse.json({
    voices: [
      { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
      { id: 'echo', name: 'Echo', description: 'Warm and conversational' },
      { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
      { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
      { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
      { id: 'shimmer', name: 'Shimmer', description: 'Clear and gentle' },
    ],
    defaultVoice: 'nova',
  });
}

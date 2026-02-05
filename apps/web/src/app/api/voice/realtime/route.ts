import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { logger } from '@/lib/logger';

/**
 * POST /api/voice/realtime
 *
 * Creates an ephemeral session token for OpenAI Realtime API WebRTC connection.
 * The client uses this token to establish a direct WebRTC connection to OpenAI.
 */
export async function POST(request: NextRequest) {
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse('OpenAI API key not configured', 500, 'CONFIG_ERROR');
  }

  try {
    const body = await request.json().catch(() => ({}));
    const voice = body.voice || 'nova';
    const instructions = body.instructions || 'You are Q8, a helpful AI personal assistant. Be concise and friendly.';

    // Request ephemeral token from OpenAI Realtime API
    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice,
        instructions,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type: 'server_vad' },
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      logger.error('Failed to create realtime session', {
        status: tokenResponse.status,
        error: errorData,
        userId: user.id,
      });
      return errorResponse(
        'Failed to create voice session',
        tokenResponse.status >= 500 ? 502 : tokenResponse.status,
        'REALTIME_SESSION_ERROR'
      );
    }

    const sessionData = await tokenResponse.json();

    return NextResponse.json({
      clientSecret: sessionData.client_secret?.value,
      sessionId: sessionData.id,
      expiresAt: sessionData.client_secret?.expires_at,
    });
  } catch (error) {
    logger.error('Realtime session creation failed', { error, userId: user.id });
    return errorResponse('Voice session creation failed', 500, 'INTERNAL_ERROR');
  }
}

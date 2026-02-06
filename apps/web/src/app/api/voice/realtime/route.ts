import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { logger } from '@/lib/logger';
import { resolveRealtimeSessionConfig } from '@q8/ai-config';

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

    const { openAIConfig, metadata } = resolveRealtimeSessionConfig({
      userId: user.id,
      requestedVoice: body.voice,
      requestedInstructions: body.instructions,
    });

    // Request ephemeral token from OpenAI Realtime API
    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIConfig),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      logger.error('Failed to create realtime session', {
        status: tokenResponse.status,
        error: errorData,
        userId: user.id,
        realtimeConfigVersion: metadata.version,
        realtimeModel: metadata.model,
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
      negotiated: {
        ...metadata,
      },
    });
  } catch (error) {
    logger.error('Realtime session creation failed', { error, userId: user.id });
    return errorResponse('Voice session creation failed', 500, 'INTERNAL_ERROR');
  }
}

/**
 * Chat API Route
 * Server-side LLM processing with agent orchestration
 * Now with enriched context (time, location, weather)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/agents';
import { buildEnrichedContext } from '@/lib/agents/context-provider';
import type { AgentMessage } from '@/lib/agents/types';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { chatMessageSchema, validationErrorResponse } from '@/lib/validations';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate input
    const parseResult = chatMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return validationErrorResponse(parseResult.error);
    }

    const { message, conversationId, userProfile } = parseResult.data;
    const userId = user.id; // Use authenticated user ID

    logger.info('[Chat API] Received request', { message, userId, conversationId });

    // Create agent message
    const agentMessage: AgentMessage = {
      content: message,
      role: 'user',
    };

    // Build enriched context with time, location, weather
    const sessionId = conversationId || Date.now().toString();
    const enrichedContext = await buildEnrichedContext(
      userId,
      sessionId,
      userProfile ? {
        name: userProfile.name,
        timezone: userProfile.timezone,
        communicationStyle: userProfile.communicationStyle,
        preferences: {},
      } : undefined
    );

    logger.info('[Chat API] Enriched context built', {
      time: enrichedContext.localTimeFormatted,
      location: enrichedContext.location.city,
      weather: enrichedContext.weather?.condition,
    });

    logger.info('[Chat API] Processing message through orchestrator');

    // Process message through agent orchestrator with enriched context
    const response = await processMessage(agentMessage, enrichedContext);

    logger.info('[Chat API] Response received', {
      agent: response.agent,
      contentLength: response.content.length,
    });

    // Return response with context metadata
    return NextResponse.json({
      content: response.content,
      agent: response.agent,
      metadata: {
        ...response.metadata,
        context: {
          time: enrichedContext.localTimeFormatted,
          date: enrichedContext.localDateFormatted,
          location: enrichedContext.location.city,
          weather: enrichedContext.weather ? {
            temp: enrichedContext.weather.temp,
            condition: enrichedContext.weather.condition,
          } : null,
        },
      },
    });
  } catch (error) {
    logger.error('[Chat API] Error', { error: error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('[Chat API] Error details', { errorMessage, errorStack });

    return NextResponse.json(
      {
        error: 'Failed to process message',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

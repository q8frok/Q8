import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { logger } from '@/lib/logger';

// TODO: Phase 4 — Migrate finance insights to SDK finance agent
// The legacy finance-advisor sub-agent has been removed.
// Finance AI insights will be generated via the main chat SDK pipeline.

/**
 * GET /api/finance/ai/insights
 * Generate proactive financial insights for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    return NextResponse.json({
      insights: [],
      count: 0,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Finance insights error', { error });
    return errorResponse('Failed to generate insights', 500);
  }
}

/**
 * POST /api/finance/ai/insights
 * Generate insights with additional context or refresh for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    return NextResponse.json({
      insights: [],
      count: 0,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Finance insights POST error', { error });
    return errorResponse('Failed to generate insights', 500);
  }
}

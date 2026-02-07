/**
 * Bio-Rhythm API Route
 * GET - Get current bio-rhythm state
 * POST - Apply bio-rhythm lighting preset
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { getBioRhythmState } from '@/lib/integrations/oura';
import { logger } from '@/lib/logger';

// TODO: Phase 2 — Migrate bio-rhythm lighting to SDK home tools
export const runtime = 'edge';

/**
 * GET /api/bio-rhythm
 * Get current bio-rhythm state from Oura Ring
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const bioRhythm = await getBioRhythmState();

    if (!bioRhythm) {
      return NextResponse.json({
        configured: false,
        message: 'Oura Ring not connected. Add OURA_PERSONAL_ACCESS_TOKEN to enable bio-rhythm features.',
      });
    }

    return NextResponse.json({
      configured: true,
      ...bioRhythm,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Bio-Rhythm] API error', { userId: user.id, error: errorMessage });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/bio-rhythm
 * Apply bio-rhythm lighting preset to specified lights
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { lightEntityIds } = body as { lightEntityIds?: string[] };

    // TODO: Phase 2 — Migrate to SDK home tools
    logger.info('[Bio-Rhythm] Lighting request', { userId: user.id, lightEntityIds });
    return NextResponse.json({ success: false, message: 'Bio-rhythm lighting is being migrated to the new agent system.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Bio-Rhythm] Apply lighting error', { userId: user.id, error: errorMessage });
    return NextResponse.json({ error: 'Failed to apply lighting' }, { status: 500 });
  }
}

/**
 * Morning Brief Cron API Route
 * Triggered by Vercel Cron at 8 AM daily
 * Generates morning briefs for all users
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generateMorningBrief } from '@/lib/agents/proactive/morning-brief';
import { getAuthenticatedUser } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes max for cron

/**
 * Verify the request is from Vercel Cron
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // In development, allow without secret
    return process.env.NODE_ENV !== 'production';
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * GET /api/cron/morning-brief
 * Generate morning briefs for all active users
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  logger.info('[MorningBrief Cron] Starting morning brief generation');

  try {
    // Get all active users who haven't received a brief today
    // In production, this would use user preferences for timing
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get users who have opted in to morning briefs (via user_context)
    const { data: optedInUsers, error: contextError } = await supabaseAdmin
      .from('user_context')
      .select('user_id')
      .eq('context_type', 'preference')
      .eq('key', 'morning_brief_enabled')
      .eq('value', { enabled: true });

    if (contextError) {
      logger.error('[MorningBrief Cron] Failed to fetch opted-in users', { error: contextError });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // If no explicit opt-ins, get all active users (for MVP)
    let userIds: string[] = (optedInUsers || []).map((u: { user_id: string }) => u.user_id);

    if (userIds.length === 0) {
      // Fallback: get users who logged in within last 7 days
      const { data: activeUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      userIds = (activeUsers || []).map((u: { id: string }) => u.id);
    }

    // Filter out users who already received a brief today
    const { data: existingBriefs } = await supabaseAdmin
      .from('proactive_briefs')
      .select('user_id')
      .eq('brief_type', 'morning_brief')
      .gte('created_at', startOfDay.toISOString());

    const usersWithBriefs = new Set((existingBriefs || []).map((b: { user_id: string }) => b.user_id));
    const usersToProcess = userIds.filter((id) => !usersWithBriefs.has(id));

    logger.info('[MorningBrief Cron] Processing users', {
      total: userIds.length,
      toProcess: usersToProcess.length,
      alreadyHaveBrief: usersWithBriefs.size,
    });

    // Generate briefs in parallel (max 10 concurrent)
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const BATCH_SIZE = 10;
    for (let i = 0; i < usersToProcess.length; i += BATCH_SIZE) {
      const batch = usersToProcess.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (userId) => {
          try {
            await generateMorningBrief(userId);
            results.success++;
            logger.debug('[MorningBrief Cron] Generated brief for user', { userId });
          } catch (error) {
            results.failed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push(`${userId}: ${errorMessage}`);
            logger.error('[MorningBrief Cron] Failed to generate brief', { userId, error: errorMessage });
          }
        })
      );
    }

    const duration = Date.now() - startTime;
    logger.info('[MorningBrief Cron] Completed', {
      duration,
      ...results,
    });

    return NextResponse.json({
      success: true,
      processed: usersToProcess.length,
      results,
      duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[MorningBrief Cron] Fatal error', { error: errorMessage });

    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/morning-brief
 * Manually trigger brief generation for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from auth session
    const user = await getAuthenticatedUser(request);

    // Also support passing userId in body (for admin/testing)
    let userId: string | undefined;

    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // No body provided, use authenticated user
    }

    // Use authenticated user if no userId provided
    if (!userId && user) {
      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const brief = await generateMorningBrief(userId);

    return NextResponse.json({
      success: true,
      brief,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[MorningBrief] Manual generation failed', { error: errorMessage });

    return NextResponse.json(
      { error: 'Failed to generate brief', details: errorMessage },
      { status: 500 }
    );
  }
}

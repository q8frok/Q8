/**
 * Briefs Latest API Route
 * GET - Get the latest morning brief for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

/**
 * GET /api/briefs/latest
 * Get the latest unread morning brief
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    // Get today's start
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get the latest brief from today
    const { data: brief, error } = await supabaseAdmin
      .from('proactive_briefs')
      .select('id, content, read_at, created_at')
      .eq('user_id', user.id)
      .eq('brief_type', 'morning_brief')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      logger.error('[Briefs] Failed to fetch latest brief', { userId: user.id, error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!brief) {
      return NextResponse.json({ brief: null, hasUnread: false });
    }

    return NextResponse.json({
      brief: brief.content,
      briefId: brief.id,
      hasUnread: !brief.read_at,
      createdAt: brief.created_at,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Briefs] API error', { error: errorMessage });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

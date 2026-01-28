/**
 * Briefs Mark Read API Route
 * POST - Mark a brief as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

/**
 * POST /api/briefs/mark-read
 * Mark the latest brief of a type as read
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { briefId, briefType } = body as { briefId?: string; briefType?: string };

    if (briefId) {
      // Mark specific brief as read
      const { error } = await supabaseAdmin
        .from('proactive_briefs')
        .update({ read_at: new Date().toISOString() })
        .eq('id', briefId)
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        logger.error('[Briefs] Failed to mark as read', { briefId, error });
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    } else if (briefType) {
      // Mark latest unread brief of type as read
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { error } = await supabaseAdmin
        .from('proactive_briefs')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('brief_type', briefType)
        .gte('created_at', startOfDay.toISOString())
        .is('read_at', null);

      if (error) {
        logger.error('[Briefs] Failed to mark as read by type', { briefType, error });
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { error: 'Either briefId or briefType is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Briefs] API error', { error: errorMessage });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

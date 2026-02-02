/**
 * Reprocess Document API
 *
 * POST /api/documents/[id]/reprocess - Reset and requeue document for processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { reprocessDocument } from '@/lib/documents';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id: documentId } = await params;

  try {
    await reprocessDocument(documentId, user.id);

    logger.info('[Documents] Reprocess queued', {
      userId: user.id,
      documentId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Documents] Reprocess failed', { error: errorMessage });

    const status = errorMessage === 'Unauthorized' ? 403
      : errorMessage === 'Document not found' ? 404
      : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

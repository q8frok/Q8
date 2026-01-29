/**
 * Move Document API
 *
 * PATCH /api/documents/[id]/move - Move document to a folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { moveDocument } from '@/lib/documents';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';

const moveSchema = z.object({
  folderId: z.string().uuid().nullable(),
});

/**
 * PATCH /api/documents/[id]/move
 * Move document to a folder (null = root)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = moveSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    await moveDocument(id, user.id, parseResult.data.folderId);

    logger.info('[Documents] Moved', {
      userId: user.id,
      documentId: id,
      folderId: parseResult.data.folderId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Documents] Move failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

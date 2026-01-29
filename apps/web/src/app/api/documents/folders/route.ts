/**
 * Folders API
 *
 * POST /api/documents/folders - Create a new folder
 * GET /api/documents/folders - Get full folder tree
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { createFolder, getFolderTree } from '@/lib/documents';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

/**
 * POST /api/documents/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const parseResult = createFolderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { name, parentId, color } = parseResult.data;

    const folder = await createFolder(user.id, name, parentId, color);

    logger.info('[Folders] Created', {
      userId: user.id,
      folderId: folder.id,
      name: folder.name,
      parentId: folder.parentId,
    });

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Folders] Create failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/folders
 * Get full folder tree
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const tree = await getFolderTree(user.id);

    return NextResponse.json({
      success: true,
      tree,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Folders] Tree fetch failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Single Folder API
 *
 * GET /api/documents/folders/[folderId] - Get folder contents
 * PATCH /api/documents/folders/[folderId] - Rename or move folder
 * DELETE /api/documents/folders/[folderId] - Delete folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { getFolderContents, renameFolder, moveFolder, deleteFolder } from '@/lib/documents';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/documents/folders/[folderId]
 * Get folder contents (subfolders + documents + breadcrumb)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { folderId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const contents = await getFolderContents(user.id, folderId, {
      limit: Math.min(limit, 100),
      offset,
    });

    return NextResponse.json({
      success: true,
      ...contents,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Folders] Contents fetch failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/folders/[folderId]
 * Rename or move folder
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { folderId } = await params;
    const body = await request.json();
    const parseResult = updateFolderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { name, parentId } = parseResult.data;
    let folder;

    if (name !== undefined) {
      folder = await renameFolder(folderId, user.id, name);
    }

    if (parentId !== undefined) {
      folder = await moveFolder(folderId, user.id, parentId);
    }

    if (!folder) {
      return NextResponse.json(
        { error: 'No update provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Folders] Update failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/folders/[folderId]
 * Delete folder (cascades subfolders, orphans documents to root)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { folderId } = await params;
    await deleteFolder(folderId, user.id);

    logger.info('[Folders] Deleted', { userId: user.id, folderId });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Folders] Delete failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

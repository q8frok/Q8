/**
 * Note Folders API Route
 * GET - List user's folders
 * POST - Create new folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { NoteFolderInsert } from '@/lib/supabase/types';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { createFolderSchema, validationErrorResponse } from '@/lib/validations';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

/**
 * GET /api/notes/folders
 * List folders for a user
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const userId = user.id; // Use authenticated user

    const { data: folders, error } = await supabaseAdmin
      .from('note_folders')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('[Folders API] Error fetching folders', { error });
      return errorResponse('Failed to fetch folders', 500);
    }

    // Also get note counts per folder
    const { data: noteCounts } = await supabaseAdmin
      .from('notes')
      .select('folder_id')
      .eq('user_id', userId)
      .eq('is_archived', false);

    const folderCounts: Record<string, number> = {};
    noteCounts?.forEach((note) => {
      if (note.folder_id) {
        folderCounts[note.folder_id] = (folderCounts[note.folder_id] || 0) + 1;
      }
    });

    const foldersWithCounts = folders?.map((folder) => ({
      ...folder,
      note_count: folderCounts[folder.id] || 0,
    }));

    return NextResponse.json({ folders: foldersWithCounts || [] });
  } catch (error) {
    logger.error('[Folders API] Error', { error });
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/notes/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Validate input
    const parseResult = createFolderSchema.safeParse(body);
    if (!parseResult.success) {
      return validationErrorResponse(parseResult.error);
    }

    const { name, icon, color, parentId } = parseResult.data;
    const userId = user.id; // Use authenticated user

    // Get max sort_order for new folder
    const { data: maxSort } = await supabaseAdmin
      .from('note_folders')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const folderData: NoteFolderInsert = {
      user_id: userId,
      name,
      icon: icon || null,
      color: color || null,
      parent_id: parentId || null,
      sort_order: (maxSort?.sort_order || 0) + 1,
    };

    const { data: folder, error } = await supabaseAdmin
      .from('note_folders')
      .insert(folderData)
      .select()
      .single();

    if (error) {
      logger.error('[Folders API] Error creating folder', { error });
      return errorResponse('Failed to create folder', 500);
    }

    return NextResponse.json({ folder });
  } catch (error) {
    logger.error('[Folders API] Error', { error });
    return errorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /api/notes/folders
 * Delete a folder (moves notes to root)
 */
export async function DELETE(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('id');

    if (!folderId) {
      return errorResponse('Folder ID is required', 400);
    }

    // Move notes to root first
    await supabaseAdmin
      .from('notes')
      .update({ folder_id: null })
      .eq('folder_id', folderId);

    // Delete the folder
    const { error } = await supabaseAdmin
      .from('note_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      logger.error('[Folders API] Error deleting folder', { error });
      return errorResponse('Failed to delete folder', 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Folders API] Error', { error });
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Bulk Document Actions API
 *
 * POST /api/documents/bulk - Perform bulk operations on documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { errorResponse } from '@/lib/api/error-responses';
import { deleteDocument } from '@/lib/documents';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bulkSchema = z.object({
  action: z.enum(['delete', 'move', 'tag']),
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  params: z.object({
    folderId: z.string().uuid().nullable().optional(),
    tagId: z.string().uuid().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid request', 400);
  }

  const { action, documentIds, params } = parsed.data;
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  try {
    switch (action) {
      case 'delete': {
        for (const docId of documentIds) {
          try {
            await deleteDocument(docId, user.id);
            results.push({ id: docId, success: true });
          } catch (error) {
            results.push({ id: docId, success: false, error: error instanceof Error ? error.message : 'Failed' });
          }
        }
        break;
      }

      case 'move': {
        const folderId = params?.folderId ?? null;
        const { error } = await supabaseAdmin
          .from('documents')
          .update({ folder_id: folderId })
          .in('id', documentIds)
          .eq('user_id', user.id);

        if (error) {
          return errorResponse(error.message, 500);
        }
        results.push(...documentIds.map((id) => ({ id, success: true })));
        break;
      }

      case 'tag': {
        const tagId = params?.tagId;
        if (!tagId) {
          return errorResponse('tagId required for tag action', 400);
        }

        const assignments = documentIds.map((docId) => ({
          document_id: docId,
          tag_id: tagId,
        }));

        // Use upsert to avoid conflicts
        const { error } = await supabaseAdmin
          .from('document_tag_assignments')
          .upsert(assignments, { onConflict: 'document_id,tag_id' });

        if (error) {
          return errorResponse(error.message, 500);
        }
        results.push(...documentIds.map((id) => ({ id, success: true })));
        break;
      }
    }

    logger.info('[Documents] Bulk action completed', {
      action,
      count: documentIds.length,
      succeeded: results.filter((r) => r.success).length,
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Documents] Bulk action failed', { error: errorMessage });
    return errorResponse(errorMessage, 500);
  }
}

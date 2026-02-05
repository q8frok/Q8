/**
 * Single Document API
 *
 * GET /api/documents/[id] - Get document with chunks
 * DELETE /api/documents/[id] - Delete a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { errorResponse, notFoundResponse } from '@/lib/api/error-responses';
import { getDocumentWithChunks, deleteDocument } from '@/lib/documents';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]
 * Get a single document with its chunks
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const document = await getDocumentWithChunks(id, user.id);

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'Document not found') {
      return notFoundResponse('Document');
    }

    logger.error('[Documents] Get failed', { error: errorMessage });
    return errorResponse(errorMessage, 500);
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document and its chunks
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    await deleteDocument(id, user.id);

    logger.info('[Documents] Deleted', {
      userId: user.id,
      documentId: id,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'Document not found') {
      return notFoundResponse('Document');
    }
    if (errorMessage === 'Unauthorized') {
      return errorResponse('Unauthorized', 403, 'FORBIDDEN');
    }

    logger.error('[Documents] Delete failed', { error: errorMessage });
    return errorResponse(errorMessage, 500);
  }
}

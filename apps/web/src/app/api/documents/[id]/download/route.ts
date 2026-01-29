/**
 * Document Download API
 *
 * GET /api/documents/[id]/download - Get a signed URL for downloading
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]/download
 * Returns a signed URL for downloading the document
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;

    // Verify document ownership
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('storage_path, storage_bucket, user_id, original_name, mime_type')
      .eq('id', id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (doc.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if this is a preview request (inline) vs download (attachment)
    const mode = request.nextUrl.searchParams.get('mode');
    const isPreview = mode === 'preview';

    // Generate signed URL (1 hour expiry)
    // For preview: omit download option so browser renders inline (Content-Disposition: inline)
    // For download: set download filename (Content-Disposition: attachment)
    const signedUrlOptions: { download?: string } = isPreview
      ? {}
      : { download: doc.original_name };

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 3600, signedUrlOptions);

    if (signedUrlError || !signedUrlData) {
      logger.error('[Documents] Failed to generate signed URL', { error: signedUrlError });
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedUrlData.signedUrl,
      fileName: doc.original_name,
      mimeType: doc.mime_type,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Documents] Download failed', { error: errorMessage });

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

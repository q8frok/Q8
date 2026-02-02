/**
 * Document Versions API
 *
 * GET /api/documents/[id]/versions - List version history
 * POST /api/documents/[id]/versions - Upload new version
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { uploadDocument } from '@/lib/documents';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: documentId } = await params;

  // Get the document to find the version chain root
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('id, parent_document_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Find the root document ID (the original)
  const rootId = doc.parent_document_id || doc.id;

  // Get all versions in the chain
  const { data: versions, error } = await supabaseAdmin
    .from('documents')
    .select('id, name, version, is_latest, size_bytes, created_at, status')
    .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
    .eq('user_id', user.id)
    .order('version', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    versions: versions || [],
    rootDocumentId: rootId,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: documentId } = await params;

  // Get the current document
  const { data: currentDoc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !currentDoc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    // Mark current as not-latest
    await supabaseAdmin
      .from('documents')
      .update({ is_latest: false })
      .eq('id', documentId);

    // Determine root document ID
    const rootId = currentDoc.parent_document_id || currentDoc.id;

    // Upload new version
    const newDoc = await uploadDocument(file, user.id, {
      scope: currentDoc.scope,
      threadId: currentDoc.thread_id || undefined,
      name: currentDoc.name,
      folderId: currentDoc.folder_id || undefined,
    });

    // Update new doc with version info
    await supabaseAdmin
      .from('documents')
      .update({
        version: (currentDoc.version || 1) + 1,
        parent_document_id: rootId,
        is_latest: true,
      })
      .eq('id', newDoc.id);

    logger.info('[Documents] New version uploaded', {
      documentId: newDoc.id,
      parentId: rootId,
      version: (currentDoc.version || 1) + 1,
    });

    return NextResponse.json({
      success: true,
      document: { ...newDoc, version: (currentDoc.version || 1) + 1 },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Documents] Version upload failed', { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

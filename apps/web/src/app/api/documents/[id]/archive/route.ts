/**
 * Document Archive API
 *
 * POST /api/documents/[id]/archive - Archive document
 * DELETE /api/documents/[id]/archive - Restore from archive
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: documentId } = await params;

  // Get document and store previous status
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('id, status, metadata')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.status === 'archived') {
    return NextResponse.json({ error: 'Document is already archived' }, { status: 400 });
  }

  const metadata = (doc.metadata as Record<string, unknown>) || {};

  const { error } = await supabaseAdmin
    .from('documents')
    .update({
      status: 'archived',
      metadata: { ...metadata, previous_status: doc.status },
    })
    .eq('id', documentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logger.info('[Documents] Archived', { documentId });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: documentId } = await params;

  // Get document
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('id, status, metadata')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.status !== 'archived') {
    return NextResponse.json({ error: 'Document is not archived' }, { status: 400 });
  }

  const metadata = (doc.metadata as Record<string, unknown>) || {};
  const previousStatus = (metadata.previous_status as string) || 'ready';
  // Remove previous_status from metadata
  const { previous_status: _, ...cleanMetadata } = metadata;

  const { error } = await supabaseAdmin
    .from('documents')
    .update({
      status: previousStatus,
      metadata: cleanMetadata,
    })
    .eq('id', documentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logger.info('[Documents] Restored from archive', { documentId, restoredStatus: previousStatus });
  return NextResponse.json({ success: true, restoredStatus: previousStatus });
}

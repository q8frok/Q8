/**
 * Document Tag Assignments API
 *
 * PUT /api/documents/[id]/tags - Assign tags to document
 * DELETE /api/documents/[id]/tags - Remove tag from document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const assignTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

const removeTagSchema = z.object({
  tagId: z.string().uuid(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: documentId } = await params;
  const body = await request.json();
  const parsed = assignTagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Verify document ownership
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Remove existing assignments and re-assign
  await supabaseAdmin
    .from('document_tag_assignments')
    .delete()
    .eq('document_id', documentId);

  if (parsed.data.tagIds.length > 0) {
    const assignments = parsed.data.tagIds.map((tagId) => ({
      document_id: documentId,
      tag_id: tagId,
    }));

    const { error } = await supabaseAdmin
      .from('document_tag_assignments')
      .insert(assignments);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: documentId } = await params;
  const body = await request.json();
  const parsed = removeTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Verify document ownership
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await supabaseAdmin
    .from('document_tag_assignments')
    .delete()
    .eq('document_id', documentId)
    .eq('tag_id', parsed.data.tagId);

  return NextResponse.json({ success: true });
}

/**
 * Document Tags API
 *
 * GET /api/documents/tags - List user's tags
 * POST /api/documents/tags - Create a new tag
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { data: tags, error } = await supabaseAdmin
    .from('document_tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tags: (tags || []).map((t: Record<string, unknown>) => ({
      id: t.id,
      userId: t.user_id,
      name: t.name,
      color: t.color,
      createdAt: t.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid tag data', details: parsed.error.issues }, { status: 400 });
  }

  const { name, color } = parsed.data;

  const { data: tag, error } = await supabaseAdmin
    .from('document_tags')
    .insert({ user_id: user.id, name, color: color || null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tag: {
      id: tag.id,
      userId: tag.user_id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.created_at,
    },
  });
}

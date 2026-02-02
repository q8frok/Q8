/**
 * Document Storage Stats API
 *
 * GET /api/documents/stats - Get storage usage statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const [totalResult, byStatusResult, byTypeResult, chunksResult] = await Promise.all([
    // Total storage used
    supabaseAdmin
      .from('documents')
      .select('size_bytes')
      .eq('user_id', user.id)
      .neq('status', 'archived'),

    // Count by status
    supabaseAdmin
      .from('documents')
      .select('status')
      .eq('user_id', user.id),

    // Count by file type
    supabaseAdmin
      .from('documents')
      .select('file_type, size_bytes')
      .eq('user_id', user.id)
      .neq('status', 'archived'),

    // Total chunks and tokens
    supabaseAdmin
      .from('documents')
      .select('chunk_count, token_count')
      .eq('user_id', user.id)
      .eq('status', 'ready'),
  ]);

  // Calculate total storage
  const totalStorageBytes = (totalResult.data || []).reduce(
    (sum, row) => sum + ((row as { size_bytes: number }).size_bytes || 0),
    0
  );

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const row of (byStatusResult.data || []) as Array<{ status: string }>) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }

  // Size by file type
  const byType: Record<string, { count: number; sizeBytes: number }> = {};
  for (const row of (byTypeResult.data || []) as Array<{ file_type: string; size_bytes: number }>) {
    const existing = byType[row.file_type] || { count: 0, sizeBytes: 0 };
    existing.count++;
    existing.sizeBytes += row.size_bytes || 0;
    byType[row.file_type] = existing;
  }

  // Totals
  const totalChunks = (chunksResult.data || []).reduce(
    (sum, row) => sum + ((row as { chunk_count: number }).chunk_count || 0),
    0
  );
  const totalTokens = (chunksResult.data || []).reduce(
    (sum, row) => sum + ((row as { token_count: number }).token_count || 0),
    0
  );

  const totalDocuments = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

  // Quota: 500MB default
  const quotaBytes = 500 * 1024 * 1024;

  return NextResponse.json({
    success: true,
    stats: {
      totalStorageBytes,
      totalDocuments,
      totalChunks,
      totalTokens,
      quotaBytes,
      usagePercent: Math.round((totalStorageBytes / quotaBytes) * 100),
      byStatus,
      byType,
    },
  });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const INTERVAL_MINUTES = 30;

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

export async function GET() {
  const { data: latest, error } = await supabaseAdmin
    .from('lifeos_job_runs')
    .select('status,started_at,finished_at,duration_ms,details,created_at')
    .eq('job_name', 'phase2.7_pipeline')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ ok: true, intervalMinutes: INTERVAL_MINUTES, lastRun: null, nextDueAt: null, mode: 'mock' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!latest) {
    return NextResponse.json({ ok: true, intervalMinutes: INTERVAL_MINUTES, lastRun: null, nextDueAt: null });
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRuns, error: recentErr } = await supabaseAdmin
    .from('lifeos_job_runs')
    .select('status,duration_ms,created_at')
    .eq('job_name', 'phase2.7_pipeline')
    .gte('created_at', since24h)
    .order('created_at', { ascending: false })
    .limit(200);

  if (recentErr && !isMissingTableError(recentErr)) {
    return NextResponse.json({ ok: false, error: recentErr.message }, { status: 500 });
  }

  const recent = recentRuns ?? [];
  const successCount = recent.filter((r) => r.status === 'success').length;
  const successRate24h = recent.length > 0 ? Number(((successCount / recent.length) * 100).toFixed(1)) : null;
  const avgDurationMs24h =
    recent.length > 0 ? Math.round(recent.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / recent.length) : null;
  const consecutiveFailures = recent.findIndex((r) => r.status === 'success');
  const consecutiveFailuresCount = consecutiveFailures === -1 ? recent.length : consecutiveFailures;

  const nextDue = new Date(new Date(latest.finished_at).getTime() + INTERVAL_MINUTES * 60 * 1000).toISOString();

  return NextResponse.json({
    ok: true,
    intervalMinutes: INTERVAL_MINUTES,
    lastRun: latest,
    nextDueAt: nextDue,
    health24h: {
      runs: recent.length,
      successRatePct: successRate24h,
      avgDurationMs: avgDurationMs24h,
      consecutiveFailures: consecutiveFailuresCount,
    },
  });
}

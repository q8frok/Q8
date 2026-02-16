import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const INTERVAL_MINUTES = 30;

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

export async function GET() {
  const { data, error } = await supabaseAdmin
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

  if (!data) {
    return NextResponse.json({ ok: true, intervalMinutes: INTERVAL_MINUTES, lastRun: null, nextDueAt: null });
  }

  const nextDue = new Date(new Date(data.finished_at).getTime() + INTERVAL_MINUTES * 60 * 1000).toISOString();

  return NextResponse.json({
    ok: true,
    intervalMinutes: INTERVAL_MINUTES,
    lastRun: data,
    nextDueAt: nextDue,
  });
}

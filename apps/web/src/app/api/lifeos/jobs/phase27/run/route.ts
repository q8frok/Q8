import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { runAlertsGenerate, runWorkOpsIngest } from '@/lib/lifeos/pipeline';

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

export async function POST() {
  const started = Date.now();
  try {
    const [snapshot, alerts] = await Promise.all([runWorkOpsIngest(), runAlertsGenerate()]);
    const finished = Date.now();

    const { error: runInsertErr } = await supabaseAdmin.from('lifeos_job_runs').insert({
      job_name: 'phase2.7_pipeline',
      status: 'success',
      started_at: new Date(started).toISOString(),
      finished_at: new Date(finished).toISOString(),
      duration_ms: finished - started,
      details: {
        snapshotId: snapshot?.id,
        alertsCreated: alerts?.created ?? 0,
      },
    });

    if (runInsertErr && !isMissingTableError(runInsertErr)) {
      throw new Error(runInsertErr.message);
    }

    return NextResponse.json({ ok: true, mode: 'db', durationMs: finished - started, details: { alertsCreated: alerts?.created ?? 0 } });
  } catch (error) {
    const finished = Date.now();

    const { error: failInsertErr } = await supabaseAdmin.from('lifeos_job_runs').insert({
      job_name: 'phase2.7_pipeline',
      status: 'failed',
      started_at: new Date(started).toISOString(),
      finished_at: new Date(finished).toISOString(),
      duration_ms: finished - started,
      details: {
        error: error instanceof Error ? error.message : 'pipeline failed',
      },
    });

    if (failInsertErr && !isMissingTableError(failInsertErr)) {
      // swallow secondary logging failure; primary error will be returned below
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'pipeline failed' },
      { status: 500 }
    );
  }
}

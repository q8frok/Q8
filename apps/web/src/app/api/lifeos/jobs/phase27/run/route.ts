import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dispatchWithApprovalPolicy } from '@/lib/lifeos/approval-policy';
import { runAlertsGenerate, runWorkOpsIngest } from '@/lib/lifeos/pipeline';

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

async function maybeEmitFailureAlert() {
  const { data, error } = await supabaseAdmin
    .from('lifeos_job_runs')
    .select('status,created_at')
    .eq('job_name', 'phase2.7_pipeline')
    .order('created_at', { ascending: false })
    .limit(2);

  if (error || !data || data.length < 2) return;

  const [latestRun, previousRun] = data;
  if (!latestRun || !previousRun) return;
  if (latestRun.status !== 'failed' || previousRun.status !== 'failed') return;

  const alertId = `al-phase27-fail-${Date.now()}`;
  await supabaseAdmin.from('alert_events').insert({
    id: alertId,
    domain: 'work-ops',
    title: 'Phase2.7 pipeline failed 2 consecutive runs',
    severity: 'critical',
    source: 'phase2.8_health_guard',
  });
}

export async function POST() {
  const started = Date.now();
  try {
    const [snapshot, alerts] = await Promise.all([runWorkOpsIngest(), runAlertsGenerate()]);
    const policy = await dispatchWithApprovalPolicy(alerts.candidates ?? []);
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
        metrics: alerts?.metrics ?? {},
        policy,
      },
    });

    if (runInsertErr && !isMissingTableError(runInsertErr)) {
      throw new Error(runInsertErr.message);
    }

    return NextResponse.json({
      ok: true,
      mode: 'db',
      durationMs: finished - started,
      details: {
        alertsCreated: alerts?.created ?? 0,
        metrics: alerts?.metrics ?? {},
        policy,
      },
    });
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

    try {
      await maybeEmitFailureAlert();
    } catch {
      // best-effort alert emission
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'pipeline failed' },
      { status: 500 }
    );
  }
}

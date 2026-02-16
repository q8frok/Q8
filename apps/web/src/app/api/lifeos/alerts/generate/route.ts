import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function evaluateThreshold(operator: string, value: number, threshold: number): boolean {
  switch (operator) {
    case '<=':
      return value <= threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '>':
      return value > threshold;
    case '=':
    case '==':
      return value === threshold;
    default:
      return false;
  }
}

export async function POST() {
  const [{ data: thresholds, error: tErr }, { data: snapshot, error: sErr }] = await Promise.all([
    supabaseAdmin
      .from('alert_thresholds')
      .select('domain,metric,operator,threshold,severity,enabled')
      .eq('enabled', true),
    supabaseAdmin
      .from('work_ops_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (tErr || sErr) {
    return NextResponse.json({ ok: false, error: tErr?.message || sErr?.message }, { status: 500 });
  }

  if (!snapshot) {
    return NextResponse.json({ ok: true, created: 0, message: 'no snapshot available' });
  }

  const metrics: Record<string, number> = {
    catering_lead_time_hours: snapshot.urgent_vendor_windows > 0 ? 48 : 96,
    dining_spend_delta_pct_7d: 28, // phase2.6 finance connector placeholder
    night_scene_missed_count_24h: 1, // phase2.6 home connector placeholder
  };

  const events = (thresholds ?? [])
    .filter((t) => metrics[t.metric] !== undefined)
    .filter((t) => evaluateThreshold(t.operator, metrics[t.metric], Number(t.threshold)))
    .map((t, idx) => ({
      id: `evt-${Date.now()}-${idx}`,
      domain: t.domain,
      title: `${t.metric} ${t.operator} ${t.threshold} (value=${metrics[t.metric]})`,
      severity: t.severity,
      source: 'phase2.6_threshold_eval',
    }));

  if (events.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'no thresholds triggered' });
  }

  const { error: insertErr } = await supabaseAdmin.from('alert_events').insert(events);
  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: events.length, mode: 'db' });
}

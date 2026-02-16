import { supabaseAdmin } from '@/lib/supabase/server';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function runWorkOpsIngest() {
  const todayIso = startOfToday();
  const weekIso = startOfWeek();

  const [{ count: todayCount }, { count: weekCount }, { count: cateringCount }] = await Promise.all([
    supabaseAdmin.from('calendar_events').select('id', { count: 'exact', head: true }).gte('start_time', todayIso),
    supabaseAdmin.from('calendar_events').select('id', { count: 'exact', head: true }).gte('start_time', weekIso),
    supabaseAdmin
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .or('title.ilike.%catering%,description.ilike.%catering%')
      .gte('start_time', weekIso),
  ]);

  const { data: pendingApprovals } = await supabaseAdmin
    .from('approval_queue')
    .select('id,domain,severity,status')
    .eq('status', 'pending');

  const pendingResponses = (pendingApprovals ?? []).filter((a) => a.domain === 'work-ops').length;
  const stockoutRisks = (pendingApprovals ?? []).filter((a) => a.domain === 'work-ops' && a.severity === 'red').length;

  const staffingScheduled = 11;
  const staffingClockedIn = 9;
  const staffingVarianceFlags = Math.max(staffingScheduled - staffingClockedIn, 0);
  const urgentVendorWindows = stockoutRisks > 0 ? 1 : 0;

  const payload = {
    reservations_this_week: weekCount ?? 0,
    reservations_today: todayCount ?? 0,
    pending_responses: pendingResponses,
    catering_events: cateringCount ?? 0,
    staffing_scheduled: staffingScheduled,
    staffing_clocked_in: staffingClockedIn,
    staffing_variance_flags: staffingVarianceFlags,
    stockout_risks: stockoutRisks,
    urgent_vendor_windows: urgentVendorWindows,
    source: 'phase2.7_ingest',
  };

  const { data, error } = await supabaseAdmin.from('work_ops_snapshots').insert(payload).select('*').single();
  if (error) throw new Error(error.message);

  return data;
}

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

export async function runAlertsGenerate() {
  const [{ data: thresholds, error: tErr }, { data: snapshot, error: sErr }] = await Promise.all([
    supabaseAdmin.from('alert_thresholds').select('domain,metric,operator,threshold,severity,enabled').eq('enabled', true),
    supabaseAdmin.from('work_ops_snapshots').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (tErr || sErr) throw new Error(tErr?.message || sErr?.message || 'pipeline error');
  if (!snapshot) return { created: 0 };

  const metrics: Record<string, number> = {
    catering_lead_time_hours: snapshot.urgent_vendor_windows > 0 ? 48 : 96,
    dining_spend_delta_pct_7d: 28,
    night_scene_missed_count_24h: 1,
  };

  const events = (thresholds ?? [])
    .filter((t) => metrics[t.metric] !== undefined)
    .filter((t) => evaluateThreshold(t.operator, metrics[t.metric], Number(t.threshold)))
    .map((t, idx) => ({
      id: `evt-${Date.now()}-${idx}`,
      domain: t.domain,
      title: `${t.metric} ${t.operator} ${t.threshold} (value=${metrics[t.metric]})`,
      severity: t.severity,
      source: 'phase2.7_threshold_eval',
    }));

  if (events.length === 0) return { created: 0 };

  const { error: insertErr } = await supabaseAdmin.from('alert_events').insert(events);
  if (insertErr) throw new Error(insertErr.message);

  return { created: events.length };
}

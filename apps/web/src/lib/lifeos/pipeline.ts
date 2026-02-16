import { supabaseAdmin } from '@/lib/supabase/server';

type FinanceTx = {
  amount: number | string;
  date: string;
  merchant_name: string | null;
  description: string | null;
  category: string[] | null;
};

type ThresholdCandidate = {
  id: string;
  domain: 'work-ops' | 'finance' | 'home' | 'personal';
  title: string;
  severity: 'info' | 'warning' | 'critical';
  source: string;
  metric: string;
  value: number;
  threshold: number;
  operator: string;
};

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
  const nowIso = new Date().toISOString();
  const todayIso = startOfToday();
  const weekIso = startOfWeek();

  const staffingFilter = 'title.ilike.%shift%,title.ilike.%staff%,title.ilike.%host%,title.ilike.%server%,title.ilike.%bartender%';

  const [
    { count: todayCount },
    { count: weekCount },
    { count: cateringCount },
    { count: staffingScheduledCount },
    { count: staffingClockedCount },
  ] = await Promise.all([
    supabaseAdmin.from('calendar_events').select('id', { count: 'exact', head: true }).gte('start_time', todayIso),
    supabaseAdmin.from('calendar_events').select('id', { count: 'exact', head: true }).gte('start_time', weekIso),
    supabaseAdmin
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .or('title.ilike.%catering%')
      .gte('start_time', weekIso),
    supabaseAdmin
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .or(staffingFilter)
      .gte('start_time', todayIso)
      .lt('start_time', new Date(new Date(todayIso).getTime() + 24 * 60 * 60 * 1000).toISOString()),
    supabaseAdmin
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .or(staffingFilter)
      .lte('start_time', nowIso)
      .gte('end_time', nowIso),
  ]);

  const { data: pendingApprovals } = await supabaseAdmin
    .from('approval_queue')
    .select('id,domain,severity,status')
    .eq('status', 'pending');

  const pendingResponses = (pendingApprovals ?? []).filter((a) => a.domain === 'work-ops').length;
  const stockoutRisks = (pendingApprovals ?? []).filter((a) => a.domain === 'work-ops' && a.severity === 'red').length;

  const staffingScheduled = staffingScheduledCount ?? 0;
  const staffingClockedIn = staffingClockedCount ?? 0;
  const staffingVarianceFlags = Math.max(staffingScheduled - staffingClockedIn, 0);
  const urgentVendorWindows = stockoutRisks > 0 ? 1 : 0;

  const source = 'phase2.8_ingest';
  const sourceRecordId = `${new Date().toISOString().slice(0, 13)}:00Z`;

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
    source,
    source_record_id: sourceRecordId,
    captured_at: nowIso,
    ingestion_version: 'phase2.8',
  };

  const upsertResult = await supabaseAdmin
    .from('work_ops_snapshots')
    .upsert(payload, { onConflict: 'source,source_record_id' })
    .select('*')
    .single();

  if (!upsertResult.error) {
    return upsertResult.data;
  }

  // Backward-compatible fallback if staging schema has not applied 026 yet
  const legacyPayload = {
    reservations_this_week: payload.reservations_this_week,
    reservations_today: payload.reservations_today,
    pending_responses: payload.pending_responses,
    catering_events: payload.catering_events,
    staffing_scheduled: payload.staffing_scheduled,
    staffing_clocked_in: payload.staffing_clocked_in,
    staffing_variance_flags: payload.staffing_variance_flags,
    stockout_risks: payload.stockout_risks,
    urgent_vendor_windows: payload.urgent_vendor_windows,
    source,
  };

  const legacyInsert = await supabaseAdmin.from('work_ops_snapshots').insert(legacyPayload).select('*').single();
  if (legacyInsert.error) throw new Error(legacyInsert.error.message);

  return legacyInsert.data;
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

function isDiningTx(tx: FinanceTx): boolean {
  const haystack = [tx.merchant_name ?? '', tx.description ?? '', ...(tx.category ?? [])].join(' ').toLowerCase();
  return /(restaurant|dining|cafe|coffee|bar|food|uber\s*eats|doordash|grubhub)/i.test(haystack);
}

function amountAbs(v: number | string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n);
}

async function getDiningSpendDeltaPct7d(): Promise<number> {
  const now = new Date();
  const startCurrent = new Date(now);
  startCurrent.setDate(startCurrent.getDate() - 7);
  const startPrevious = new Date(now);
  startPrevious.setDate(startPrevious.getDate() - 14);

  const { data, error } = await supabaseAdmin
    .from('finance_transactions')
    .select('amount,date,merchant_name,description,category')
    .gte('date', startPrevious.toISOString().slice(0, 10));

  if (error || !data) return 0;

  const txs = data as FinanceTx[];
  const currentStartMs = startCurrent.getTime();
  const previousStartMs = startPrevious.getTime();
  const nowMs = now.getTime();

  let currentTotal = 0;
  let previousTotal = 0;

  for (const tx of txs) {
    if (!isDiningTx(tx)) continue;
    const ts = new Date(tx.date).getTime();
    const amt = amountAbs(tx.amount);
    if (ts >= currentStartMs && ts <= nowMs) currentTotal += amt;
    else if (ts >= previousStartMs && ts < currentStartMs) previousTotal += amt;
  }

  if (previousTotal <= 0) {
    return currentTotal > 0 ? 100 : 0;
  }

  return Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(2));
}

async function getNightSceneMissedCount24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('alert_events')
    .select('id', { count: 'exact', head: true })
    .eq('domain', 'home')
    .ilike('title', '%scene missed%')
    .gte('created_at', since);

  if (error) return 0;
  return count ?? 0;
}

export async function runAlertsGenerate() {
  const [{ data: thresholds, error: tErr }, { data: snapshot, error: sErr }] = await Promise.all([
    supabaseAdmin.from('alert_thresholds').select('domain,metric,operator,threshold,severity,enabled').eq('enabled', true),
    supabaseAdmin.from('work_ops_snapshots').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (tErr || sErr) throw new Error(tErr?.message || sErr?.message || 'pipeline error');
  if (!snapshot) return { created: 0, metrics: {} as Record<string, number>, candidates: [] as ThresholdCandidate[] };

  const [diningSpendDeltaPct7d, nightSceneMissedCount24h] = await Promise.all([
    getDiningSpendDeltaPct7d(),
    getNightSceneMissedCount24h(),
  ]);

  const metrics: Record<string, number> = {
    catering_lead_time_hours: snapshot.urgent_vendor_windows > 0 ? 48 : 96,
    dining_spend_delta_pct_7d: diningSpendDeltaPct7d,
    night_scene_missed_count_24h: nightSceneMissedCount24h,
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
      metric: t.metric,
      value: metrics[t.metric],
      threshold: Number(t.threshold),
      operator: t.operator,
    }));

  if (events.length === 0) return { created: 0, metrics, candidates: [] as typeof events };

  const { error: insertErr } = await supabaseAdmin.from('alert_events').insert(
    events.map((e) => ({ id: e.id, domain: e.domain, title: e.title, severity: e.severity, source: e.source }))
  );
  if (insertErr) throw new Error(insertErr.message);

  return { created: events.length, metrics, candidates: events };
}

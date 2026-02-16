import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { AlertsResponse } from '@/types/alerts';

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

export async function GET() {
  const thresholdsRes = await supabaseAdmin
    .from('alert_thresholds')
    .select('domain,metric,operator,threshold,severity,enabled')
    .eq('enabled', true);

  const snapshotRes = await supabaseAdmin
    .from('work_ops_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (thresholdsRes.error || snapshotRes.error) {
    if (isMissingTableError(thresholdsRes.error) || isMissingTableError(snapshotRes.error)) {
      return NextResponse.json({ generatedAt: new Date().toISOString(), mode: 'mock', items: [] });
    }
    return NextResponse.json(
      { ok: false, error: thresholdsRes.error?.message || snapshotRes.error?.message },
      { status: 500 }
    );
  }

  const snapshot = snapshotRes.data;
  const items: AlertsResponse['items'] = [];

  if (snapshot) {
    for (const t of thresholdsRes.data ?? []) {
      if (t.domain === 'work-ops' && t.metric === 'catering_lead_time_hours' && t.operator === '<=') {
        const assumedLeadHours = snapshot.urgent_vendor_windows > 0 ? 48 : 96;
        if (assumedLeadHours <= Number(t.threshold)) {
          items.push({
            id: `ev-${Date.now()}-workops`,
            domain: 'work-ops',
            title: `Catering prep lead-time under ${t.threshold}h for urgent vendor window`,
            severity: t.severity,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), mode: 'db', items });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

const defaults = [
  { domain: 'work-ops', metric: 'catering_lead_time_hours', operator: '<=', threshold: 72, severity: 'critical', enabled: true },
  { domain: 'finance', metric: 'dining_spend_delta_pct_7d', operator: '>=', threshold: 25, severity: 'warning', enabled: true },
  { domain: 'home', metric: 'night_scene_missed_count_24h', operator: '>=', threshold: 1, severity: 'info', enabled: true },
];

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('alert_thresholds')
    .select('domain,metric,operator,threshold,severity,enabled')
    .eq('enabled', true)
    .order('domain', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ generatedAt: new Date().toISOString(), mode: 'mock', items: defaults });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), mode: 'db', items: data ?? [] });
}

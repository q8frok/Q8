import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { AlertsResponse } from '@/types/alerts';

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

function mockPayload(): AlertsResponse {
  return {
    generatedAt: new Date().toISOString(),
    items: [
      {
        id: 'al-2001',
        domain: 'work-ops',
        title: 'Catering prep lead-time under 72h for 2 events',
        severity: 'critical',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'al-2002',
        domain: 'finance',
        title: 'Dining-out spend exceeded 7-day baseline by 28%',
        severity: 'warning',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'al-2003',
        domain: 'home',
        title: 'Night scene missed trigger once in last 24h',
        severity: 'info',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('alert_events')
    .select('id,domain,title,severity,created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ ...mockPayload(), mode: 'mock' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    title: row.title,
    severity: row.severity,
    createdAt: row.created_at,
  }));

  if (items.length === 0) {
    return NextResponse.json({ ...mockPayload(), mode: 'mock' });
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), mode: 'db', items });
}

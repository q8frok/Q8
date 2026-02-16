import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { WorkOpsSnapshot } from '@/types/workops';

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

function mockPayload(): WorkOpsSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    reservations: {
      thisWeek: 18,
      today: 4,
      pendingResponses: 3,
      cateringEvents: 6,
    },
    staffing: {
      scheduled: 11,
      clockedIn: 9,
      varianceFlags: 2,
    },
    inventory: {
      stockoutRisks: 3,
      urgentVendorWindows: 1,
    },
    nextAction: 'Review pending reservation replies and finalize Tuesday order drafts',
  };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('work_ops_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ ...mockPayload(), mode: 'mock' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ...mockPayload(), mode: 'mock' });
  }

  const payload: WorkOpsSnapshot = {
    generatedAt: new Date().toISOString(),
    reservations: {
      thisWeek: data.reservations_this_week,
      today: data.reservations_today,
      pendingResponses: data.pending_responses,
      cateringEvents: data.catering_events,
    },
    staffing: {
      scheduled: data.staffing_scheduled,
      clockedIn: data.staffing_clocked_in,
      varianceFlags: data.staffing_variance_flags,
    },
    inventory: {
      stockoutRisks: data.stockout_risks,
      urgentVendorWindows: data.urgent_vendor_windows,
    },
    nextAction: 'Validate flagged staffing/inventory risks and clear pending replies.',
  };

  return NextResponse.json({ ...payload, mode: 'db' });
}

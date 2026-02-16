import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function POST() {
  try {
    const todayIso = startOfToday();
    const weekIso = startOfWeek();

    // Calendar-driven reservation signals
    const [{ count: todayCount }, { count: weekCount }, { count: cateringCount }] = await Promise.all([
      supabaseAdmin
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', todayIso),
      supabaseAdmin
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', weekIso),
      supabaseAdmin
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .or('title.ilike.%catering%,description.ilike.%catering%')
        .gte('start_time', weekIso),
    ]);

    // Queue-driven risk signals
    const { data: pendingApprovals } = await supabaseAdmin
      .from('approval_queue')
      .select('id,domain,severity,status')
      .eq('status', 'pending');

    const pendingResponses = (pendingApprovals ?? []).filter((a) => a.domain === 'work-ops').length;
    const stockoutRisks = (pendingApprovals ?? []).filter((a) => a.domain === 'work-ops' && a.severity === 'red').length;

    // Staffing/Square scaffolds (until full connector is wired)
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
      source: 'phase2.6_ingest',
    };

    const { data, error } = await supabaseAdmin
      .from('work_ops_snapshots')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mode: 'db', snapshot: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'ingest failed' },
      { status: 500 }
    );
  }
}

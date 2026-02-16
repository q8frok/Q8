import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ApprovalItem, ApprovalQueueResponse } from '@/types/approvals';

function mockItems(): ApprovalItem[] {
  return [
    {
      id: 'ap-1001',
      title: 'Vendor draft order (Good Trading) ready for review',
      domain: 'work-ops',
      severity: 'yellow',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ap-1002',
      title: 'Enable autonomous night-shift routine update',
      domain: 'home',
      severity: 'yellow',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ap-1003',
      title: 'Execute external order placement (requires explicit approval)',
      domain: 'work-ops',
      severity: 'red',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ];
}

function isMissingTableError(error: unknown): boolean {
  const e = (error as { code?: string; message?: string } | null) ?? {};
  return e.code === '42P01' || (e.message?.toLowerCase().includes('could not find the table') ?? false);
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('approval_queue')
    .select('id,title,domain,severity,status,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ generatedAt: new Date().toISOString(), items: mockItems(), mode: 'mock' });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items: ApprovalItem[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    domain: row.domain,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
  }));

  const payload: ApprovalQueueResponse = {
    generatedAt: new Date().toISOString(),
    items,
  };

  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: 'approve' | 'reject' };

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: 'id and action are required' }, { status: 400 });
  }

  const status = action === 'approve' ? 'approved' : 'rejected';

  const nowIso = new Date().toISOString();
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('approval_queue')
    .select('id,severity,metadata')
    .eq('id', id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('approval_queue')
    .update({ status, updated_at: nowIso })
    .eq('id', id);

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({
        ok: true,
        id,
        status,
        actedAt: new Date().toISOString(),
        mode: 'simulation',
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (action === 'approve' && existing?.severity === 'yellow') {
    const actionKey = (existing.metadata as { actionKey?: string } | null)?.actionKey;
    if (actionKey) {
      await supabaseAdmin.from('approval_grants').upsert(
        {
          action_key: actionKey,
          source_approval_id: id,
          active: true,
          approved_at: nowIso,
        },
        { onConflict: 'action_key' }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    id,
    status,
    actedAt: nowIso,
    mode: 'db',
  });
}

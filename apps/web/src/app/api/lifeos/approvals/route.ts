import { NextResponse } from 'next/server';
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

export async function GET() {
  const payload: ApprovalQueueResponse = {
    generatedAt: new Date().toISOString(),
    items: mockItems(),
  };

  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: 'approve' | 'reject' };

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: 'id and action are required' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    id,
    status: action === 'approve' ? 'approved' : 'rejected',
    actedAt: new Date().toISOString(),
    mode: 'simulation',
  });
}

import { NextResponse } from 'next/server';
import type { ApprovalQueueResponse } from '@/types/approvals';

export async function GET() {
  const payload: ApprovalQueueResponse = {
    generatedAt: new Date().toISOString(),
    items: [
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
    ],
  };

  return NextResponse.json(payload);
}

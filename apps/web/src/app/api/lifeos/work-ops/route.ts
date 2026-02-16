import { NextResponse } from 'next/server';
import type { WorkOpsSnapshot } from '@/types/workops';

export async function GET() {
  const payload: WorkOpsSnapshot = {
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

  return NextResponse.json(payload);
}

import { NextResponse } from 'next/server';
import type { AlertsResponse } from '@/types/alerts';

export async function GET() {
  const payload: AlertsResponse = {
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

  return NextResponse.json(payload);
}

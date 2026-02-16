import { NextResponse } from 'next/server';
import { integrations } from '@/lib/env';
import type { LifeOSOverview } from '@/types/lifeos';

function nowIso() {
  return new Date().toISOString();
}

export async function GET() {
  const payload: LifeOSOverview = {
    generatedAt: nowIso(),
    integrations: {
      square: Boolean(process.env.SQUARE_ACCESS_TOKEN),
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      homeAssistant: integrations.homeAssistant.isConfigured,
      plaid: integrations.plaid.isConfigured,
      github: integrations.github.isConfigured,
    },
    domains: [
      {
        kind: 'work-ops',
        score: 42,
        openItems: 9,
        urgentItems: 2,
        lastUpdated: nowIso(),
        nextAction: 'Connect reservation inbox + calendar parser',
      },
      {
        kind: 'approvals',
        score: 35,
        openItems: 5,
        urgentItems: 1,
        lastUpdated: nowIso(),
        nextAction: 'Enable action queue with green/yellow/red policy',
      },
      {
        kind: 'health',
        score: 28,
        openItems: 4,
        urgentItems: 1,
        lastUpdated: nowIso(),
        nextAction: 'Activate night-shift protocol reminders',
      },
      {
        kind: 'knowledge',
        score: 31,
        openItems: 7,
        urgentItems: 0,
        lastUpdated: nowIso(),
        nextAction: 'Import and classify Apple Notes exports',
      },
      {
        kind: 'people',
        score: 22,
        openItems: 3,
        urgentItems: 0,
        lastUpdated: nowIso(),
        nextAction: 'Create follow-up cadence for key contacts',
      },
      {
        kind: 'growth',
        score: 38,
        openItems: 6,
        urgentItems: 1,
        lastUpdated: nowIso(),
        nextAction: 'Ship weekly leverage opportunities digest',
      },
      {
        kind: 'alerts',
        score: 44,
        openItems: 8,
        urgentItems: 3,
        lastUpdated: nowIso(),
        nextAction: 'Unify risk thresholds across work + finance',
      },
    ],
  };

  return NextResponse.json(payload);
}

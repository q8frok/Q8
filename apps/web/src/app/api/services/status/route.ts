/**
 * Service Status API
 * Returns which integrations are configured/available
 */

import { NextResponse } from 'next/server';
import { integrations } from '@/lib/env';

export interface ServiceStatus {
  homeAssistant: boolean;
  google: boolean;
  github: boolean;
  finance: boolean;
  spotify: boolean;
}

export async function GET() {
  const status: ServiceStatus = {
    homeAssistant: integrations.homeAssistant.isConfigured,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: integrations.github.isConfigured,
    finance: integrations.plaid.isConfigured || integrations.snaptrade.isConfigured,
    spotify: integrations.spotify.isConfigured,
  };

  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

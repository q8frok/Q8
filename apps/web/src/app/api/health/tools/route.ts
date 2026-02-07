/**
 * Tool Health Check Endpoint
 * GET /api/health/tools
 *
 * Checks connectivity and credential availability for all external tool integrations.
 * Returns a summary of which tools are ready, degraded, or unavailable.
 */

import { NextResponse } from 'next/server';

interface ToolHealthStatus {
  name: string;
  status: 'ok' | 'degraded' | 'error' | 'not_configured';
  message: string;
  latencyMs?: number;
}

async function checkSpotify(): Promise<ToolHealthStatus> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      name: 'spotify',
      status: 'not_configured',
      message: 'Missing credentials: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, or SPOTIFY_REFRESH_TOKEN',
    };
  }

  const start = Date.now();
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        name: 'spotify',
        status: 'error',
        message: `Token refresh failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
        latencyMs,
      };
    }

    return { name: 'spotify', status: 'ok', message: 'Token refresh successful', latencyMs };
  } catch (error) {
    return {
      name: 'spotify',
      status: 'error',
      message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      latencyMs: Date.now() - start,
    };
  }
}

async function checkHomeAssistant(): Promise<ToolHealthStatus> {
  const hassUrl = process.env.HASS_URL;
  const hassToken = process.env.HASS_TOKEN;

  if (!hassToken) {
    return { name: 'home_assistant', status: 'not_configured', message: 'Missing HASS_TOKEN' };
  }
  if (!hassUrl) {
    return { name: 'home_assistant', status: 'not_configured', message: 'Missing HASS_URL' };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${hassUrl}/api/`, {
      headers: { Authorization: `Bearer ${hassToken}` },
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - start;

    if (res.status === 401 || res.status === 403) {
      return {
        name: 'home_assistant',
        status: 'error',
        message: `Auth failed: ${res.status} — HASS_TOKEN may be expired or revoked`,
        latencyMs,
      };
    }

    if (!res.ok) {
      return {
        name: 'home_assistant',
        status: 'degraded',
        message: `Unexpected status: ${res.status} ${res.statusText}`,
        latencyMs,
      };
    }

    return { name: 'home_assistant', status: 'ok', message: 'Connected', latencyMs };
  } catch (error) {
    return {
      name: 'home_assistant',
      status: 'error',
      message: `Unreachable: ${error instanceof Error ? error.message : String(error)}`,
      latencyMs: Date.now() - start,
    };
  }
}

function checkGoogleOAuth(): ToolHealthStatus {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      name: 'google_workspace',
      status: 'not_configured',
      message: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
    };
  }

  // Google tools require per-user OAuth tokens stored in Supabase.
  // We can only verify the app credentials are present; actual token validity
  // depends on whether the user has completed the OAuth flow.
  return {
    name: 'google_workspace',
    status: 'ok',
    message: 'OAuth app credentials configured. Per-user tokens require account linking in Settings.',
  };
}

function checkGitHub(): ToolHealthStatus {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  if (!token) {
    return { name: 'github', status: 'not_configured', message: 'Missing GITHUB_PERSONAL_ACCESS_TOKEN' };
  }

  return { name: 'github', status: 'ok', message: 'Token configured' };
}

function checkOpenWeather(): ToolHealthStatus {
  const key = process.env.OPENWEATHER_API_KEY;

  if (!key) {
    return { name: 'weather', status: 'not_configured', message: 'Missing OPENWEATHER_API_KEY' };
  }

  return { name: 'weather', status: 'ok', message: 'API key configured' };
}

function checkFinance(): ToolHealthStatus {
  const plaidClientId = process.env.PLAID_CLIENT_ID;
  const plaidSecret = process.env.PLAID_SECRET;

  if (!plaidClientId || !plaidSecret) {
    return {
      name: 'finance',
      status: 'not_configured',
      message: 'Missing PLAID_CLIENT_ID or PLAID_SECRET — finance tools will use Supabase data only',
    };
  }

  return { name: 'finance', status: 'ok', message: 'Plaid credentials configured' };
}

function checkSquare(): ToolHealthStatus {
  const token = process.env.SQUARE_ACCESS_TOKEN;

  if (!token) {
    return { name: 'square', status: 'not_configured', message: 'Missing SQUARE_ACCESS_TOKEN' };
  }

  return { name: 'square', status: 'ok', message: 'Access token configured' };
}

function checkOuraRing(): ToolHealthStatus {
  const token = process.env.OURA_PERSONAL_ACCESS_TOKEN;

  if (!token) {
    return { name: 'oura_ring', status: 'not_configured', message: 'Missing OURA_PERSONAL_ACCESS_TOKEN' };
  }

  return { name: 'oura_ring', status: 'ok', message: 'Access token configured' };
}

export async function GET() {
  const [spotify, homeAssistant] = await Promise.all([
    checkSpotify(),
    checkHomeAssistant(),
  ]);

  const results: ToolHealthStatus[] = [
    spotify,
    homeAssistant,
    checkGoogleOAuth(),
    checkGitHub(),
    checkOpenWeather(),
    checkFinance(),
    checkSquare(),
    checkOuraRing(),
  ];

  const configured = results.filter(r => r.status !== 'not_configured');
  const allOk = configured.length > 0 && configured.every(r => r.status === 'ok');
  const anyError = configured.some(r => r.status === 'error');

  return NextResponse.json({
    status: allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded',
    timestamp: new Date().toISOString(),
    tools: results,
  });
}

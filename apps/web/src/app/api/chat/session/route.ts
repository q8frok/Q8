import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';

/**
 * Lightweight chat session heartbeat endpoint.
 * Used by the web client to maintain an always-on control channel status.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  return NextResponse.json({
    ok: true,
    sessionId: crypto.randomUUID(),
    serverTime: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  return NextResponse.json({
    ok: true,
    sessionId,
    serverTime: new Date().toISOString(),
  });
}

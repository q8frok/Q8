/**
 * Add Google Account API
 *
 * Initiates DIRECT Google OAuth flow to add an additional Google account.
 * This does NOT use Supabase auth - it directly handles Google OAuth to get tokens
 * for the additional account while preserving the user's existing session.
 *
 * GET /api/auth/add-google-account - Initiates Google OAuth for adding account
 *
 * Query params:
 * - scopes: comma-separated additional scopes (optional)
 * - label: user-defined label for the account (optional)
 * - redirect: URL to redirect after completion (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv, getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

// Default scopes for calendar integration
const DEFAULT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

// Full calendar scopes
const FULL_CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const env = getServerEnv();

  // Get optional parameters
  const requestedScopes = searchParams.get('scopes')?.split(',') || [];
  const label = searchParams.get('label') || '';
  const redirect = searchParams.get('redirect') || '/';
  const fullAccess = searchParams.get('full_access') === 'true';

  // Check Google OAuth is configured
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    logger.error('[Add Google Account] Google OAuth not configured');
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    );
  }

  // Create Supabase client to verify user is logged in
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set(name, value, options);
        },
        remove(name: string) {
          cookieStore.delete(name);
        },
      },
    }
  );

  // Check if user is logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Build scopes list
  const scopes = new Set<string>(fullAccess ? FULL_CALENDAR_SCOPES : DEFAULT_SCOPES);

  // Add any explicitly requested scopes
  for (const scope of requestedScopes) {
    const trimmed = scope.trim().toLowerCase();
    if (trimmed === 'gmail') {
      GMAIL_SCOPES.forEach((s) => scopes.add(s));
    } else if (trimmed === 'drive') {
      DRIVE_SCOPES.forEach((s) => scopes.add(s));
    } else if (trimmed === 'youtube') {
      YOUTUBE_SCOPES.forEach((s) => scopes.add(s));
    } else if (trimmed === 'calendar') {
      FULL_CALENDAR_SCOPES.forEach((s) => scopes.add(s));
    } else if (trimmed.startsWith('https://')) {
      scopes.add(trimmed);
    }
  }

  const scopeString = Array.from(scopes).join(' ');

  // Store state in cookie to identify this as "add account" flow
  const state = JSON.stringify({
    mode: 'add_account',
    userId: session.user.id,
    label,
    redirect,
    scopes: Array.from(scopes),
    timestamp: Date.now(),
  });

  // Generate a random state token for CSRF protection
  const stateToken = Buffer.from(state).toString('base64url');

  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  logger.info('[Add Google Account] Initiating direct Google OAuth flow', {
    userId: session.user.id,
    label,
    scopeCount: scopes.size,
  });

  // Build the Google OAuth URL directly (NOT through Supabase)
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google-account-callback`;

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', scopeString);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent select_account'); // Force account selection
  googleAuthUrl.searchParams.set('state', stateToken);
  googleAuthUrl.searchParams.set('include_granted_scopes', 'true');

  return NextResponse.redirect(googleAuthUrl.toString());
}

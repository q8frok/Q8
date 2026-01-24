/**
 * Link Google Account API
 *
 * Allows users who signed up with email to link their Google account
 * for YouTube API access.
 *
 * GET /api/auth/link-google - Initiates Google OAuth linking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

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
        remove(name: string, options) {
          cookieStore.delete(name);
        },
      },
    }
  );

  // Check if user is logged in
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Use signInWithOAuth to authenticate/re-authenticate with Google
  // This works even when linkIdentity is disabled in Supabase
  // It will prompt for consent and grant all requested scopes including Calendar
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
      scopes: 'email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent', // Force consent screen to ensure new scopes are granted
      },
    },
  });

  if (error) {
    console.error('Link identity error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
}

/**
 * Re-authenticate with Google API
 *
 * Re-authenticates the user with Google to obtain new tokens with updated scopes.
 * Use this when the user needs additional permissions (e.g., Calendar access)
 * that weren't granted during initial signup.
 *
 * GET /api/auth/reauth-google - Initiates Google OAuth re-authentication
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

  // Use signInWithOAuth to re-authenticate with Google
  // This will prompt for consent again and grant new scopes
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
      scopes: 'email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent', // Force consent screen to get new scopes
      },
    },
  });

  if (error) {
    console.error('Re-auth error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
}

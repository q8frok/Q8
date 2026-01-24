/**
 * Google Account Callback API
 *
 * Handles OAuth callback for adding Google accounts.
 * This uses DIRECT Google OAuth (not Supabase) to preserve the user's session
 * while adding tokens for additional Google accounts.
 *
 * GET /api/auth/google-account-callback - OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv, getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { addGoogleAccount } from '@/lib/auth/google-accounts';

export const runtime = 'nodejs';

interface OAuthState {
  mode: 'add_account';
  userId: string;
  label: string;
  redirect: string;
  scopes: string[];
  timestamp: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const cookieStore = await cookies();
  const origin = getOrigin(request);
  const env = getServerEnv();

  // Handle OAuth errors
  if (error) {
    logger.error('[Google Account Callback] OAuth error', { error, errorDescription });
    const errorMessage = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(`${origin}/?google_error=${errorMessage}`);
  }

  if (!code) {
    logger.error('[Google Account Callback] No authorization code');
    return NextResponse.redirect(`${origin}/?google_error=No+authorization+code`);
  }

  // Get stored state from cookie
  const storedStateStr = cookieStore.get('google_oauth_state')?.value;

  if (!storedStateStr) {
    logger.error('[Google Account Callback] No OAuth state in cookie');
    return NextResponse.redirect(`${origin}/?google_error=Invalid+OAuth+state`);
  }

  let state: OAuthState;
  try {
    state = JSON.parse(storedStateStr);
  } catch {
    logger.error('[Google Account Callback] Failed to parse OAuth state');
    return NextResponse.redirect(`${origin}/?google_error=Invalid+OAuth+state`);
  }

  // Verify state token matches (CSRF protection)
  if (stateParam) {
    try {
      const decodedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
      if (decodedState.userId !== state.userId || decodedState.timestamp !== state.timestamp) {
        logger.error('[Google Account Callback] State mismatch');
        return NextResponse.redirect(`${origin}/?google_error=Invalid+OAuth+state`);
      }
    } catch {
      logger.error('[Google Account Callback] Failed to verify state token');
      return NextResponse.redirect(`${origin}/?google_error=Invalid+OAuth+state`);
    }
  }

  // Validate state
  if (state.mode !== 'add_account' || !state.userId) {
    logger.error('[Google Account Callback] Invalid state mode', { state });
    return NextResponse.redirect(`${origin}/?google_error=Invalid+OAuth+state`);
  }

  // Check state freshness (10 minutes)
  if (Date.now() - state.timestamp > 10 * 60 * 1000) {
    logger.error('[Google Account Callback] OAuth state expired');
    return NextResponse.redirect(`${origin}/?google_error=OAuth+session+expired`);
  }

  // Create Supabase client to verify user session is still valid
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Ignore - might be called after response started
          }
        },
        remove(name: string) {
          try {
            cookieStore.delete(name);
          } catch {
            // Ignore
          }
        },
      },
    }
  );

  // Verify user is still logged in with the same session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || session.user.id !== state.userId) {
    logger.error('[Google Account Callback] User session mismatch', {
      sessionUserId: session?.user.id,
      stateUserId: state.userId,
    });
    return NextResponse.redirect(`${origin}/login?error=Session+expired`);
  }

  try {
    // Exchange code for tokens DIRECTLY with Google (not through Supabase)
    const redirectUri = `${origin}/api/auth/google-account-callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID || '',
        client_secret: env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('[Google Account Callback] Token exchange failed', {
        status: tokenResponse.status,
        error: errorText,
      });
      return NextResponse.redirect(`${origin}/?google_error=Token+exchange+failed`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      logger.error('[Google Account Callback] No access token in response');
      return NextResponse.redirect(`${origin}/?google_error=No+access+token+received`);
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      logger.error('[Google Account Callback] Failed to get user info');
      return NextResponse.redirect(`${origin}/?google_error=Failed+to+get+user+info`);
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    // Store account in database
    const result = await addGoogleAccount({
      userId: state.userId,
      googleAccountId: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      avatarUrl: userInfo.picture,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: expiresAt,
      scopes: state.scopes,
      label: state.label || undefined,
      isPrimary: false, // New accounts are not primary by default
    });

    if (!result.success) {
      logger.error('[Google Account Callback] Failed to save account', {
        error: result.error,
      });
      return NextResponse.redirect(
        `${origin}/?google_error=${encodeURIComponent(result.error || 'Failed to save account')}`
      );
    }

    logger.info('[Google Account Callback] Successfully added Google account', {
      userId: state.userId,
      email: userInfo.email,
      accountId: result.account?.id,
    });

    // Clear OAuth state cookie
    cookieStore.delete('google_oauth_state');

    // Redirect to success URL
    const redirectUrl = state.redirect || '/';
    const successUrl = new URL(redirectUrl, origin);
    successUrl.searchParams.set('google_account_added', 'true');
    successUrl.searchParams.set('email', userInfo.email);

    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    logger.error('[Google Account Callback] Unexpected error', { error });
    return NextResponse.redirect(
      `${origin}/?google_error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unexpected error'
      )}`
    );
  }
}

/**
 * Get the correct origin URL for redirects
 */
function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const url = new URL(request.url);
  return url.origin;
}

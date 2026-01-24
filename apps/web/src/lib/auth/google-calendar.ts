/**
 * Google Calendar Authentication Helper
 *
 * Utilities for checking Google Calendar access and managing tokens
 */

import { supabase } from '@/lib/supabase/client';
import type { UserIdentity } from '@supabase/supabase-js';

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: 'google';
}

/**
 * Check if the user has linked their Google account with calendar scopes
 */
export async function hasCalendarAccess(): Promise<boolean> {

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return false;
  }

  // Check if user has Google identity linked
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.identities) {
    return false;
  }

  const googleIdentity = user.identities.find(
    (identity: UserIdentity) => identity.provider === 'google'
  );

  if (!googleIdentity) {
    return false;
  }

  // Check if we have a valid provider token
  // The session should have the provider_token if user authenticated with Google
  // or linked their Google account
  return !!session.provider_token || !!googleIdentity.identity_data?.provider_token;
}

/**
 * Get the Google OAuth token for API requests
 */
export async function getCalendarToken(): Promise<GoogleTokenResult | null> {
  
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // Try to get provider token from session
  if (session.provider_token) {
    return {
      accessToken: session.provider_token,
      refreshToken: session.provider_refresh_token ?? undefined,
      provider: 'google',
    };
  }

  // If no provider token in session, user needs to re-authenticate
  // This can happen after session refresh when provider token is not persisted
  return null;
}

/**
 * Refresh the Google OAuth token if expired
 * Note: Supabase handles token refresh automatically in most cases,
 * but we may need manual refresh for API calls
 */
export async function refreshCalendarToken(): Promise<GoogleTokenResult | null> {
  
  // Trigger a session refresh
  const { data: { session }, error } = await supabase.auth.refreshSession();

  if (error || !session) {
    console.error('Failed to refresh session:', error);
    return null;
  }

  if (session.provider_token) {
    return {
      accessToken: session.provider_token,
      refreshToken: session.provider_refresh_token ?? undefined,
      provider: 'google',
    };
  }

  return null;
}

/**
 * Initiate Google Calendar linking flow
 * Redirects the user to the Google OAuth consent page
 */
export function initiateCalendarLink(): void {
  // This redirects to our API route which handles the OAuth flow
  window.location.href = '/api/auth/link-google';
}

/**
 * Check if a specific error indicates auth issues
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const authErrorMessages = [
      'invalid_grant',
      'unauthorized',
      '401',
      'access_denied',
      'token expired',
      'invalid_token',
    ];
    return authErrorMessages.some(msg =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
  return false;
}

/**
 * Format error message for user display
 */
export function formatCalendarAuthError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('invalid_grant')) {
      return 'Your Google Calendar access has expired. Please re-link your account.';
    }
    if (error.message.includes('access_denied')) {
      return 'Google Calendar access was denied. Please try again and grant calendar permissions.';
    }
    if (error.message.includes('rate_limit')) {
      return 'Too many requests to Google Calendar. Please wait a moment and try again.';
    }
    return error.message;
  }
  return 'An unexpected error occurred with Google Calendar.';
}

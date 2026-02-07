/**
 * Multi-Google Account Management
 *
 * Manages multiple linked Google accounts per user for Calendar, Gmail, Drive integrations.
 * Tokens are stored server-side in Supabase for security.
 */

import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

// ============================================================
// Types
// ============================================================

export interface GoogleAccount {
  id: string;
  user_id: string;
  google_account_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  scopes: string[];
  is_primary: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleAccountWithTokens extends GoogleAccount {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
}

export interface GoogleAccountToken {
  accountId: string;
  googleAccountId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

export interface AddGoogleAccountInput {
  userId: string;
  googleAccountId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  label?: string;
  isPrimary?: boolean;
}

export interface GoogleAccountResult {
  success: boolean;
  account?: GoogleAccount;
  error?: string;
}

export interface GoogleTokenResult {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  error?: string;
}

// ============================================================
// Supabase Admin Client (Server-Side Only)
// ============================================================

function getSupabaseAdmin() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================================
// Account Management Functions
// ============================================================

/**
 * Add or update a Google account for a user
 */
export async function addGoogleAccount(input: AddGoogleAccountInput): Promise<GoogleAccountResult> {
  const supabase = getSupabaseAdmin();

  try {
    // Check if account already exists
    const { data: existing } = await supabase
      .from('user_google_accounts')
      .select('id')
      .eq('user_id', input.userId)
      .eq('google_account_id', input.googleAccountId)
      .single();

    const accountData = {
      user_id: input.userId,
      google_account_id: input.googleAccountId,
      email: input.email,
      display_name: input.displayName || null,
      avatar_url: input.avatarUrl || null,
      access_token: input.accessToken,
      refresh_token: input.refreshToken || null,
      token_expires_at: input.tokenExpiresAt?.toISOString() || null,
      scopes: input.scopes,
      label: input.label || null,
      is_primary: input.isPrimary || false,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (existing) {
      // Update existing account
      result = await supabase
        .from('user_google_accounts')
        .update(accountData)
        .eq('id', existing.id)
        .select()
        .single();

      logger.info('[Google Accounts] Updated existing account', {
        userId: input.userId,
        email: input.email,
      });
    } else {
      // Insert new account
      result = await supabase
        .from('user_google_accounts')
        .insert(accountData)
        .select()
        .single();

      logger.info('[Google Accounts] Added new account', {
        userId: input.userId,
        email: input.email,
      });
    }

    if (result.error) {
      logger.error('[Google Accounts] Failed to save account', { error: result.error });
      return { success: false, error: result.error.message };
    }

    // Strip tokens from returned account
    const { _access_token, _refresh_token, _token_expires_at, ...account } = result.data;
    return { success: true, account: account as GoogleAccount };
  } catch (error) {
    logger.error('[Google Accounts] Error adding account', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all Google accounts for a user (without tokens)
 */
export async function getGoogleAccounts(userId: string): Promise<GoogleAccount[]> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('user_google_accounts')
      .select('id, user_id, google_account_id, email, display_name, avatar_url, scopes, is_primary, label, created_at, updated_at')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[Google Accounts] Failed to fetch accounts', { error });
      return [];
    }

    return data as GoogleAccount[];
  } catch (error) {
    logger.error('[Google Accounts] Error fetching accounts', { error });
    return [];
  }
}

/**
 * Get a specific Google account by ID
 */
export async function getGoogleAccountById(
  userId: string,
  accountId: string
): Promise<GoogleAccount | null> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('user_google_accounts')
      .select('id, user_id, google_account_id, email, display_name, avatar_url, scopes, is_primary, label, created_at, updated_at')
      .eq('user_id', userId)
      .eq('id', accountId)
      .single();

    if (error) {
      return null;
    }

    return data as GoogleAccount;
  } catch (_error) {
    return null;
  }
}

/**
 * Remove a Google account
 */
export async function removeGoogleAccount(
  userId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('user_google_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('id', accountId);

    if (error) {
      logger.error('[Google Accounts] Failed to remove account', { error });
      return { success: false, error: error.message };
    }

    logger.info('[Google Accounts] Removed account', { userId, accountId });
    return { success: true };
  } catch (error) {
    logger.error('[Google Accounts] Error removing account', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update account label
 */
export async function updateAccountLabel(
  userId: string,
  accountId: string,
  label: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  try {
    const { error } = await supabase
      .from('user_google_accounts')
      .update({ label, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', accountId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set account as primary
 */
export async function setPrimaryAccount(
  userId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  try {
    // The trigger will handle unsetting other primary accounts
    const { error } = await supabase
      .from('user_google_accounts')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', accountId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Token Management Functions
// ============================================================

/**
 * Get token for a specific Google account
 */
export async function getGoogleAccountToken(
  userId: string,
  accountId: string
): Promise<GoogleTokenResult> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('user_google_accounts')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('id', accountId)
      .single();

    if (error || !data) {
      return {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        error: 'Account not found',
      };
    }

    // Check if token is expired
    const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null;
    const isExpired = expiresAt && expiresAt < new Date();

    if (isExpired && data.refresh_token) {
      // Token expired, try to refresh
      const refreshResult = await refreshGoogleAccountToken(userId, accountId);
      if (refreshResult.accessToken) {
        return refreshResult;
      }
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (error) {
    logger.error('[Google Accounts] Error getting token', { error });
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get tokens for all Google accounts of a user
 */
export async function getAllGoogleTokens(userId: string): Promise<GoogleAccountToken[]> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('user_google_accounts')
      .select('id, google_account_id, email, access_token, refresh_token, token_expires_at, scopes')
      .eq('user_id', userId);

    if (error || !data) {
      logger.error('[Google Accounts] Failed to fetch all tokens', { error });
      return [];
    }

    const tokens: GoogleAccountToken[] = [];

    for (const account of data) {
      const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
      const isExpired = expiresAt ? expiresAt < new Date() : false;
      // If no expiry is stored, we can't know if the token is valid — treat as needing refresh
      const needsRefresh = isExpired || !expiresAt;

      let accessToken = account.access_token;
      let finalExpiresAt = expiresAt;

      if (needsRefresh && account.refresh_token) {
        logger.info('[Google Accounts] Token needs refresh', {
          email: account.email,
          reason: !expiresAt ? 'no expiry stored' : 'expired',
          expiredAt: expiresAt?.toISOString(),
        });
        const refreshResult = await refreshGoogleAccountToken(userId, account.id);
        if (refreshResult.accessToken) {
          accessToken = refreshResult.accessToken;
          finalExpiresAt = refreshResult.expiresAt;
        } else if (isExpired) {
          // Token is definitely expired and refresh failed — skip
          logger.warn('[Google Accounts] Token expired and refresh failed, skipping account', {
            email: account.email,
            error: refreshResult.error,
          });
          continue;
        } else {
          // No expiry stored, refresh failed — try the existing token as last resort
          logger.warn('[Google Accounts] Refresh failed but token may still be valid, using existing', {
            email: account.email,
            error: refreshResult.error,
          });
        }
      } else if (isExpired && !account.refresh_token) {
        logger.warn('[Google Accounts] Token expired with no refresh token, skipping account', {
          email: account.email,
        });
        continue;
      }

      tokens.push({
        accountId: account.id,
        googleAccountId: account.google_account_id,
        email: account.email,
        accessToken,
        refreshToken: account.refresh_token,
        expiresAt: finalExpiresAt,
        scopes: account.scopes || [],
      });
    }

    return tokens;
  } catch (error) {
    logger.error('[Google Accounts] Error getting all tokens', { error });
    return [];
  }
}

/**
 * Refresh token for a specific Google account
 */
export async function refreshGoogleAccountToken(
  userId: string,
  accountId: string
): Promise<GoogleTokenResult> {
  const supabase = getSupabaseAdmin();
  const env = getServerEnv();

  try {
    // Get current refresh token
    const { data: account, error: fetchError } = await supabase
      .from('user_google_accounts')
      .select('refresh_token')
      .eq('user_id', userId)
      .eq('id', accountId)
      .single();

    if (fetchError || !account?.refresh_token) {
      return {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        error: 'No refresh token available',
      };
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        accessToken: null,
        refreshToken: account.refresh_token,
        expiresAt: null,
        error: 'Google OAuth not configured',
      };
    }

    // Refresh the token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Google Accounts] Token refresh failed', {
        accountId,
        httpStatus: response.status,
        error: errorText.slice(0, 500),
      });
      return {
        accessToken: null,
        refreshToken: account.refresh_token,
        expiresAt: null,
        error: `Token refresh failed (HTTP ${response.status}): ${errorText.slice(0, 200)}`,
      };
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Update token in database
    await supabase
      .from('user_google_accounts')
      .update({
        access_token: tokenData.access_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    logger.info('[Google Accounts] Token refreshed successfully', { accountId });

    return {
      accessToken: tokenData.access_token,
      refreshToken: account.refresh_token,
      expiresAt,
    };
  } catch (error) {
    logger.error('[Google Accounts] Error refreshing token', { error });
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Scope Checking Functions
// ============================================================

/**
 * Check if an account has a specific scope
 */
export function hasScope(account: GoogleAccount, scope: string): boolean {
  return account.scopes.some((s) => s.includes(scope));
}

/**
 * Check if an account has calendar access
 */
export function hasCalendarScope(account: GoogleAccount): boolean {
  return hasScope(account, 'calendar');
}

/**
 * Check if an account has Gmail access
 */
export function hasGmailScope(account: GoogleAccount): boolean {
  return hasScope(account, 'gmail') || hasScope(account, 'mail');
}

/**
 * Check if an account has Drive access
 */
export function hasDriveScope(account: GoogleAccount): boolean {
  return hasScope(account, 'drive');
}

/**
 * Get all accounts with a specific scope
 */
export async function getAccountsWithScope(
  userId: string,
  scopeSubstring: string
): Promise<GoogleAccount[]> {
  const accounts = await getGoogleAccounts(userId);
  return accounts.filter((account) => hasScope(account, scopeSubstring));
}

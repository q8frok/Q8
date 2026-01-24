/**
 * Google Accounts Management API
 *
 * GET /api/auth/google-accounts - List all linked Google accounts
 * DELETE /api/auth/google-accounts?id={accountId} - Remove a linked account
 * PATCH /api/auth/google-accounts - Update account (label, primary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import {
  getGoogleAccounts,
  removeGoogleAccount,
  updateAccountLabel,
  setPrimaryAccount,
  type GoogleAccount,
} from '@/lib/auth/google-accounts';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/google-accounts
 *
 * Returns all linked Google accounts for the authenticated user
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const accounts = await getGoogleAccounts(user.id);

    // Map to safe response (no tokens)
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      email: account.email,
      displayName: account.display_name,
      avatarUrl: account.avatar_url,
      scopes: account.scopes,
      isPrimary: account.is_primary,
      label: account.label,
      createdAt: account.created_at,
    }));

    return NextResponse.json({ accounts: safeAccounts });
  } catch (error) {
    logger.error('[Google Accounts API] Error listing accounts', { error });
    return NextResponse.json(
      { error: 'Failed to list accounts' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/google-accounts?id={accountId}
 *
 * Removes a linked Google account
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('id');

  if (!accountId) {
    return NextResponse.json(
      { error: 'Account ID is required' },
      { status: 400 }
    );
  }

  try {
    const result = await removeGoogleAccount(user.id, accountId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to remove account' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Google Accounts API] Error removing account', { error });
    return NextResponse.json(
      { error: 'Failed to remove account' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/google-accounts
 *
 * Updates account properties (label, isPrimary)
 *
 * Body:
 * - id: string (required)
 * - label?: string | null
 * - isPrimary?: boolean
 */
export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id, label, isPrimary } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Update label if provided
    if (label !== undefined) {
      const labelResult = await updateAccountLabel(user.id, id, label);
      if (!labelResult.success) {
        return NextResponse.json(
          { error: labelResult.error || 'Failed to update label' },
          { status: 400 }
        );
      }
    }

    // Set as primary if requested
    if (isPrimary === true) {
      const primaryResult = await setPrimaryAccount(user.id, id);
      if (!primaryResult.success) {
        return NextResponse.json(
          { error: primaryResult.error || 'Failed to set primary' },
          { status: 400 }
        );
      }
    }

    // Get updated accounts
    const accounts = await getGoogleAccounts(user.id);
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      email: account.email,
      displayName: account.display_name,
      avatarUrl: account.avatar_url,
      scopes: account.scopes,
      isPrimary: account.is_primary,
      label: account.label,
      createdAt: account.created_at,
    }));

    return NextResponse.json({ success: true, accounts: safeAccounts });
  } catch (error) {
    logger.error('[Google Accounts API] Error updating account', { error });
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

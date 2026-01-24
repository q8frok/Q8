import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { decrypt } from '@/lib/utils/encryption';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/api-auth';
import { integrations } from '@/lib/env';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Initialize Plaid client
const plaidConfiguration = new Configuration({
  basePath: PlaidEnvironments[integrations.plaid.env as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': integrations.plaid.clientId ?? '',
      'PLAID-SECRET': integrations.plaid.secret ?? '',
    },
  },
});
const plaidClient = new PlaidApi(plaidConfiguration);

/**
 * POST /api/finance/accounts/[id]/disconnect
 * Disconnect a linked account (removes Plaid connection but preserves transaction history)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    // Fetch the account to verify ownership and get Plaid credentials
    const { data: account, error: fetchError } = await supabase
      .from('finance_accounts')
      .select('user_id, plaid_access_token_encrypted, plaid_item_id, is_manual')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Verify ownership
    if (account.user_id !== user.id) {
      return forbiddenResponse('You do not have access to this account');
    }

    // Cannot disconnect manual accounts
    if (account.is_manual) {
      return NextResponse.json(
        { error: 'Manual accounts cannot be disconnected' },
        { status: 400 }
      );
    }

    // If this is a Plaid account, remove the Item
    if (account.plaid_access_token_encrypted && account.plaid_item_id) {
      try {
        const accessToken = decrypt(account.plaid_access_token_encrypted);
        await plaidClient.itemRemove({ access_token: accessToken });
        logger.info('Removed Plaid Item', { itemId: account.plaid_item_id });
      } catch (plaidError) {
        // Log but don't fail - the token may already be invalid
        logger.warn('Failed to remove Plaid Item (may already be invalid)', {
          error: plaidError,
          itemId: account.plaid_item_id,
        });
      }
    }

    // Update the account to clear Plaid connection while preserving history
    const { error: updateError } = await supabase
      .from('finance_accounts')
      .update({
        plaid_access_token_encrypted: null,
        plaid_item_id: null,
        plaid_account_id: null,
        sync_error: 'Disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      logger.error('Failed to update account after disconnect', { error: updateError });
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also disconnect any other accounts from the same Plaid Item
    if (account.plaid_item_id) {
      await supabase
        .from('finance_accounts')
        .update({
          plaid_access_token_encrypted: null,
          plaid_item_id: null,
          plaid_account_id: null,
          sync_error: 'Disconnected',
          updated_at: new Date().toISOString(),
        })
        .eq('plaid_item_id', account.plaid_item_id)
        .eq('user_id', user.id);
    }

    logger.info('Account disconnected', { accountId: id, userId: user.id });

    return NextResponse.json({
      success: true,
      message: 'Account disconnected. Transaction history has been preserved.',
    });
  } catch (error) {
    logger.error('Disconnect account error', { error });
    return NextResponse.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}

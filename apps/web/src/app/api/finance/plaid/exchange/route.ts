import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/utils/encryption';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * POST /api/finance/plaid/exchange
 * Exchange public token for access token and save accounts
 */
export async function POST(request: NextRequest) {
  try {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return NextResponse.json(
        { error: 'Plaid not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { publicToken, userId, metadata } = body;

    if (!publicToken || !userId) {
      return NextResponse.json(
        { error: 'Public token and user ID are required' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Encrypt the access token before storing
    const encryptedAccessToken = encrypt(accessToken);

    // Get account details
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;
    const institution = metadata?.institution;

    // Save accounts to database
    const savedAccounts = [];
    
    for (const account of accounts) {
      const accountData = {
        user_id: userId,
        name: account.name,
        type: mapPlaidAccountType(account.type),
        subtype: account.subtype || null,
        institution_name: institution?.name || 'Unknown Institution',
        institution_id: institution?.institution_id || null,
        balance_current: account.balances.current || 0,
        balance_available: account.balances.available,
        balance_limit: account.balances.limit,
        currency: account.balances.iso_currency_code || 'USD',
        plaid_access_token_encrypted: encryptedAccessToken,
        plaid_item_id: itemId,
        plaid_account_id: account.account_id,
        is_manual: false,
        is_hidden: false,
        last_synced_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('finance_accounts')
        .upsert(accountData, {
          onConflict: 'plaid_account_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving account:', error);
        continue;
      }

      savedAccounts.push({
        id: data.id,
        name: data.name,
        type: data.type,
        subtype: data.subtype,
        institutionName: data.institution_name,
        balanceCurrent: parseFloat(data.balance_current || '0'),
        balanceAvailable: data.balance_available ? parseFloat(data.balance_available) : undefined,
        currency: data.currency,
      });
    }

    // Trigger initial transaction sync
    await syncTransactions(accessToken, userId, itemId);

    return NextResponse.json({
      success: true,
      itemId,
      accounts: savedAccounts,
      accountsLinked: savedAccounts.length,
    });
  } catch (error: any) {
    console.error('Plaid exchange error:', error.response?.data || error.message);

    if (error.response?.data?.error_code) {
      return NextResponse.json(
        {
          error: error.response.data.error_message,
          errorCode: error.response.data.error_code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}

/**
 * Map Plaid account types to our schema
 */
function mapPlaidAccountType(plaidType: string): string {
  const typeMap: Record<string, string> = {
    depository: 'depository',
    credit: 'credit',
    investment: 'investment',
    loan: 'loan',
    brokerage: 'investment',
    other: 'cash',
  };
  return typeMap[plaidType] || 'cash';
}

/**
 * Sync transactions for a linked account
 */
async function syncTransactions(accessToken: string, userId: string, itemId: string) {
  try {
    // Get transactions for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      options: {
        count: 500,
        offset: 0,
      },
    });

    const transactions = response.data.transactions;

    // Get account mapping
    const { data: accounts } = await supabase
      .from('finance_accounts')
      .select('id, plaid_account_id')
      .eq('plaid_item_id', itemId);

    const accountMap = new Map(
      accounts?.map((a) => [a.plaid_account_id, a.id]) || []
    );

    // Save transactions
    for (const tx of transactions) {
      const accountId = accountMap.get(tx.account_id);
      if (!accountId) continue;

      const txData = {
        user_id: userId,
        account_id: accountId,
        amount: -tx.amount, // Plaid uses positive for debits, we use negative
        date: tx.date,
        datetime: tx.datetime || null,
        merchant_name: tx.merchant_name || tx.name,
        description: tx.name,
        category: tx.category || [],
        category_id: tx.category_id || null,
        plaid_transaction_id: tx.transaction_id,
        is_manual: false,
        is_recurring: false,
        status: tx.pending ? 'pending' : 'posted',
        is_transfer: tx.category?.includes('Transfer') || false,
        logo_url: tx.logo_url || null,
        website: tx.website || null,
        location: tx.location ? {
          city: tx.location.city,
          region: tx.location.region,
          country: tx.location.country,
          lat: tx.location.lat,
          lon: tx.location.lon,
        } : null,
        payment_channel: tx.payment_channel || null,
      };

      await supabase
        .from('finance_transactions')
        .upsert(txData, {
          onConflict: 'plaid_transaction_id',
        });
    }

    console.log(`Synced ${transactions.length} transactions for item ${itemId}`);
  } catch (error) {
    console.error('Transaction sync error:', error);
  }
}

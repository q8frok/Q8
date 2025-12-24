import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SNAPTRADE_CLIENT_ID = process.env.SNAPTRADE_CLIENT_ID;
const SNAPTRADE_CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY;
const SNAPTRADE_API_BASE = 'https://api.snaptrade.com/api/v1';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate SnapTrade signature for API requests
 */
function generateSignature(
  consumerKey: string,
  requestPath: string,
  requestBody: string,
  timestamp: string
): string {
  const signatureContent = `${requestPath}${requestBody}${timestamp}`;
  return crypto
    .createHmac('sha256', consumerKey)
    .update(signatureContent)
    .digest('base64');
}

/**
 * Make authenticated request to SnapTrade API
 */
async function snaptradeRequest(
  method: string,
  path: string,
  body?: object
): Promise<Response> {
  if (!SNAPTRADE_CLIENT_ID || !SNAPTRADE_CONSUMER_KEY) {
    throw new Error('SnapTrade not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestBody = body ? JSON.stringify(body) : '';
  const signature = generateSignature(
    SNAPTRADE_CONSUMER_KEY,
    path,
    requestBody,
    timestamp
  );

  return fetch(`${SNAPTRADE_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'clientId': SNAPTRADE_CLIENT_ID,
      'Signature': signature,
      'Timestamp': timestamp,
    },
    body: body ? requestBody : undefined,
  });
}

/**
 * GET /api/finance/snaptrade/accounts
 * Fetch all investment accounts from SnapTrade
 */
export async function GET(request: NextRequest) {
  try {
    if (!SNAPTRADE_CLIENT_ID || !SNAPTRADE_CONSUMER_KEY) {
      return NextResponse.json(
        { error: 'SnapTrade not configured', configured: false },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's accounts from SnapTrade
    const accountsResponse = await snaptradeRequest(
      'GET',
      `/accounts?userId=${userId}`
    );

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch accounts' },
        { status: 400 }
      );
    }

    const accountsData = await accountsResponse.json();

    // Transform and save accounts
    const savedAccounts = [];

    for (const account of accountsData) {
      // Get holdings for this account to calculate total value
      let totalValue = 0;
      try {
        const holdingsResponse = await snaptradeRequest(
          'GET',
          `/accounts/${account.id}/holdings?userId=${userId}`
        );
        if (holdingsResponse.ok) {
          const holdings = await holdingsResponse.json();
          totalValue = holdings.reduce(
            (sum: number, h: any) => sum + (h.marketValue || 0),
            0
          );
        }
      } catch (e) {
        console.warn('Failed to fetch holdings for account:', account.id);
      }

      const accountData = {
        user_id: userId,
        name: account.name || account.number || 'Investment Account',
        type: 'investment',
        subtype: mapSnaptradeAccountType(account.type),
        institution_name: account.institution?.name || 'Brokerage',
        institution_id: account.institution?.id || null,
        balance_current: totalValue,
        currency: account.currency || 'USD',
        snaptrade_connection_id: account.connectionId,
        snaptrade_account_id: account.id,
        is_manual: false,
        is_hidden: false,
        last_synced_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('finance_accounts')
        .upsert(accountData, {
          onConflict: 'snaptrade_account_id',
        })
        .select()
        .single();

      if (!error && data) {
        savedAccounts.push({
          id: data.id,
          name: data.name,
          type: data.type,
          subtype: data.subtype,
          institutionName: data.institution_name,
          balanceCurrent: parseFloat(data.balance_current || '0'),
          currency: data.currency,
        });
      }
    }

    return NextResponse.json({
      accounts: savedAccounts,
      totalAccounts: savedAccounts.length,
    });
  } catch (error: any) {
    console.error('SnapTrade accounts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

/**
 * Map SnapTrade account types to our schema
 */
function mapSnaptradeAccountType(snaptradeType: string | undefined): string {
  if (!snaptradeType) return 'brokerage';
  
  const typeMap: Record<string, string> = {
    INDIVIDUAL: 'brokerage',
    JOINT: 'brokerage',
    IRA: 'ira',
    ROTH_IRA: 'roth_ira',
    '401K': '401k',
    '403B': '401k',
    TFSA: 'savings',
    RRSP: 'ira',
    CRYPTO: 'crypto',
  };
  return typeMap[snaptradeType] || 'brokerage';
}

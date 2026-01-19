import { NextRequest, NextResponse } from 'next/server';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  DepositoryAccountSubtype,
  CreditAccountSubtype,
} from 'plaid';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth/api-auth';
import { integrations } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Type guard for Plaid API errors with response data
 */
interface PlaidApiError {
  response?: {
    data?: {
      error_code?: string;
      error_message?: string;
      error_type?: string;
    };
  };
  message?: string;
}

function isPlaidApiError(error: unknown): error is PlaidApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'message' in error)
  );
}

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[integrations.plaid.env as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': integrations.plaid.clientId ?? '',
      'PLAID-SECRET': integrations.plaid.secret ?? '',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * POST /api/finance/plaid/link-token
 * Generate a Plaid Link token for initializing Link
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    // Check if Plaid is configured
    if (!integrations.plaid.isConfigured) {
      return NextResponse.json(
        {
          error: 'Plaid not configured',
          configured: false,
          message: 'Add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables'
        },
        { status: 200 }
      );
    }

    const body = await request.json();
    const { accessToken } = body;
    const userId = user.id; // Use authenticated user

    // Base request config
    const linkTokenConfig: Parameters<typeof plaidClient.linkTokenCreate>[0] = {
      user: { client_user_id: userId },
      client_name: 'Q8 Finance Hub',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      // Enable account selection
      account_filters: {
        depository: {
          account_subtypes: [
            DepositoryAccountSubtype.Checking,
            DepositoryAccountSubtype.Savings,
            DepositoryAccountSubtype.MoneyMarket,
            DepositoryAccountSubtype.Cd,
          ],
        },
        credit: {
          account_subtypes: [CreditAccountSubtype.CreditCard],
        },
      },
    };

    // If updating an existing link (re-auth), include access_token
    if (accessToken) {
      linkTokenConfig.access_token = accessToken;
    }

    const response = await plaidClient.linkTokenCreate(linkTokenConfig);

    return NextResponse.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
      requestId: response.data.request_id,
    });
  } catch (error) {
    const plaidError = isPlaidApiError(error) ? error : null;
    logger.error('Plaid link token error', { error: plaidError?.response?.data || plaidError?.message || error });

    // Handle specific Plaid errors
    if (plaidError?.response?.data?.error_code) {
      return NextResponse.json(
        {
          error: plaidError.response.data.error_message,
          errorCode: plaidError.response.data.error_code,
          errorType: plaidError.response.data.error_type,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    );
  }
}

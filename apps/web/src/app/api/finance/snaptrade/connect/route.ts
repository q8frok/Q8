import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SNAPTRADE_CLIENT_ID = process.env.SNAPTRADE_CLIENT_ID;
const SNAPTRADE_CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY;
const SNAPTRADE_API_BASE = 'https://api.snaptrade.com/api/v1';

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
 * POST /api/finance/snaptrade/connect
 * Generate a SnapTrade redirect URL for connecting a brokerage
 */
export async function POST(request: NextRequest) {
  try {
    if (!SNAPTRADE_CLIENT_ID || !SNAPTRADE_CONSUMER_KEY) {
      return NextResponse.json(
        {
          error: 'SnapTrade not configured',
          configured: false,
          message: 'Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY to your environment',
        },
        { status: 200 }
      );
    }

    const body = await request.json();
    const { userId, broker } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // First, register or get the user in SnapTrade
    const userResponse = await snaptradeRequest('POST', '/snapTrade/registerUser', {
      userId: userId,
    });

    if (!userResponse.ok) {
      // User might already exist, try to get their secret
      const existingUser = await snaptradeRequest('GET', `/snapTrade/encryptedJWT?userId=${userId}`);
      if (!existingUser.ok) {
        const errorData = await userResponse.json();
        return NextResponse.json(
          { error: errorData.message || 'Failed to register user' },
          { status: 400 }
        );
      }
    }

    // Generate a redirect URI for OAuth
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/finance/snaptrade/callback`;

    // Get connection portal URL
    const portalResponse = await snaptradeRequest('POST', '/snapTrade/login', {
      userId: userId,
      broker: broker || undefined, // Optional: specific broker
      immediateRedirect: true,
      customRedirect: redirectUri,
      connectionType: 'read', // Read-only access for holdings
    });

    if (!portalResponse.ok) {
      const errorData = await portalResponse.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to generate login URL' },
        { status: 400 }
      );
    }

    const portalData = await portalResponse.json();

    return NextResponse.json({
      redirectUrl: portalData.redirectURI || portalData.loginLink,
      expiresAt: portalData.expiresAt,
    });
  } catch (error: any) {
    console.error('SnapTrade connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to SnapTrade' },
      { status: 500 }
    );
  }
}

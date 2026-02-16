import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    connectors: [
      {
        name: 'gmail_reservations',
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        status: 'scaffolded',
        next: 'Bind reservation inbox parser to spacepingpong32@gmail.com',
      },
      {
        name: 'google_calendar_events',
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        status: 'scaffolded',
        next: 'Map event labels (D/CF/CC/EB) to internal status',
      },
      {
        name: 'square_sales_labor',
        configured: Boolean(process.env.SQUARE_ACCESS_TOKEN),
        status: 'scaffolded',
        next: 'Connect sales/labor ingestion and variance checks',
      },
      {
        name: 'vendor_order_drafts',
        configured: true,
        status: 'contract-only',
        next: 'Implement draft formatter per vendor channel',
      },
    ],
  });
}

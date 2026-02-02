import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from '@/lib/auth/api-auth';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/finance/transactions/cleanup
 * Remove duplicate transactions for the authenticated user.
 *
 * Duplicates are identified by: account_id + date + abs(amount) + normalized merchant name.
 * When duplicates exist the row with the earliest created_at is kept.
 *
 * Body: { dryRun?: boolean }  – when true, returns count without deleting.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Fetch all transactions for the user
    const { data: transactions, error: fetchError } = await supabase
      .from('finance_transactions')
      .select('id, account_id, date, amount, merchant_name, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError) {
      logger.error('Cleanup: fetch error', { error: fetchError });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ deleted: 0, total: 0 });
    }

    // Build dedup map — keep the first (earliest) occurrence
    const seen = new Map<string, string>(); // key → id to keep
    const duplicateIds: string[] = [];

    for (const tx of transactions) {
      const merchantText = (tx.merchant_name || tx.description || 'unknown').toLowerCase();
      const merchantKey = merchantText.replace(/[^a-z]/g, '').substring(0, 12);
      const amountKey = Math.abs(parseFloat(tx.amount)).toFixed(2);
      const uniqueKey = `${tx.account_id}:${tx.date}:${amountKey}:${merchantKey}`;

      if (!seen.has(uniqueKey)) {
        seen.set(uniqueKey, tx.id);
      } else {
        duplicateIds.push(tx.id);
      }
    }

    if (dryRun || duplicateIds.length === 0) {
      return NextResponse.json({
        deleted: 0,
        duplicatesFound: duplicateIds.length,
        total: transactions.length,
        dryRun,
      });
    }

    // Delete in batches of 100
    let deleted = 0;
    for (let i = 0; i < duplicateIds.length; i += 100) {
      const batch = duplicateIds.slice(i, i + 100);
      const { error: deleteError } = await supabase
        .from('finance_transactions')
        .delete()
        .in('id', batch);

      if (deleteError) {
        logger.error('Cleanup: delete batch error', { error: deleteError, batch: i });
      } else {
        deleted += batch.length;
      }
    }

    logger.info('Transaction cleanup complete', {
      userId: user.id,
      deleted,
      total: transactions.length,
    });

    return NextResponse.json({
      deleted,
      duplicatesFound: duplicateIds.length,
      total: transactions.length,
    });
  } catch (error) {
    logger.error('Transaction cleanup error', { error });
    return NextResponse.json(
      { error: 'Failed to cleanup transactions' },
      { status: 500 }
    );
  }
}

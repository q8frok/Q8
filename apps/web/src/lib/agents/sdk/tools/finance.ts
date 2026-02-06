/**
 * Finance Tools
 * Query financial data from Supabase for spending analysis and account management
 * Assigned to: Finance Agent (Gemini 3 Flash)
 *
 * Uses @openai/agents tool() for native SDK integration.
 * Auth: userId from RunContext → Supabase admin queries filtered by user_id
 */

import { z } from 'zod';
import { tool, type Tool } from '@openai/agents';
import type { RunContext as SDKRunContext } from '@openai/agents';
import { createToolError } from '../utils/errors';
import type { RunContext } from '../runner';

// Lazy import to avoid calling getServerEnv() at module scope (breaks test/client envs)
async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  return supabaseAdmin;
}

// =============================================================================
// Helpers
// =============================================================================

function getUserId(context?: SDKRunContext<RunContext>): string | null {
  return context?.context?.userId ?? null;
}

function noUserContext(): string {
  return JSON.stringify({
    success: false,
    message: 'No user context available. Cannot access financial data.',
  });
}

function periodToDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'ytd': return new Date(now.getFullYear(), 0, 1);
    case '1y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

// =============================================================================
// finance_get_accounts
// =============================================================================

const financeGetAccountsSchema = z.object({
  include_hidden: z.boolean().default(false).describe('Include hidden accounts'),
});

export const financeGetAccountsTool = tool<typeof financeGetAccountsSchema, RunContext>({
  name: 'finance_get_accounts',
  description: 'Get all linked financial accounts with current balances, types, and institutions.',
  parameters: financeGetAccountsSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const supabase = await getSupabaseAdmin();
      let query = supabase
        .from('finance_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('type', { ascending: true });

      if (!args.include_hidden) {
        query = query.neq('is_hidden', true);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const accounts = (data ?? []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        institution: a.institution_name,
        balance: a.balance_current,
        currency: a.currency || 'USD',
        lastSynced: a.last_synced,
      }));

      const totalAssets = accounts
        .filter(a => !['credit', 'loan'].includes(a.type ?? ''))
        .reduce((sum, a) => sum + (a.balance ?? 0), 0);
      const totalLiabilities = accounts
        .filter(a => ['credit', 'loan'].includes(a.type ?? ''))
        .reduce((sum, a) => sum + Math.abs(a.balance ?? 0), 0);

      return JSON.stringify({
        success: true,
        accounts,
        summary: {
          totalAccounts: accounts.length,
          totalAssets,
          totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
        },
      });
    } catch (error) {
      return JSON.stringify(createToolError('finance_get_accounts', error));
    }
  },
});

// =============================================================================
// finance_get_transactions
// =============================================================================

const financeGetTransactionsSchema = z.object({
  limit: z.number().default(20).describe('Number of transactions to return (default: 20)'),
  merchant: z.string().nullable().describe('Filter by merchant name (partial match)'),
  category: z.string().nullable().describe('Filter by category (e.g., "Food and Drink", "Shopping")'),
  min_amount: z.number().nullable().describe('Minimum amount (absolute value)'),
  max_amount: z.number().nullable().describe('Maximum amount (absolute value)'),
  period: z.string().default('30d').describe('Time period to search: 7d, 30d, 90d, ytd, or 1y'),
  type: z.string().default('all').describe('Filter by transaction type: expense, income, or all'),
});

export const financeGetTransactionsTool = tool<typeof financeGetTransactionsSchema, RunContext>({
  name: 'finance_get_transactions',
  description: 'Get recent transactions with filtering by merchant, category, amount, and time period.',
  parameters: financeGetTransactionsSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const startDate = periodToDate(args.period);

      const supabase = await getSupabaseAdmin();
      let query = supabase
        .from('finance_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(args.limit);

      if (args.merchant) {
        query = query.ilike('merchant_name', `%${args.merchant}%`);
      }
      if (args.category) {
        query = query.ilike('category', `%${args.category}%`);
      }
      if (args.type === 'expense') {
        query = query.gt('amount', 0); // Plaid convention: positive = expense
      } else if (args.type === 'income') {
        query = query.lt('amount', 0);
      }
      if (args.min_amount != null) {
        query = query.gte('amount', args.min_amount);
      }
      if (args.max_amount != null) {
        query = query.lte('amount', args.max_amount);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const transactions = (data ?? []).map(t => ({
        id: t.id,
        date: t.date,
        merchant: t.merchant_name,
        amount: t.amount,
        category: t.category,
        subcategory: t.subcategory,
        pending: t.pending,
        accountId: t.account_id,
      }));

      return JSON.stringify({
        success: true,
        transactions,
        count: transactions.length,
      });
    } catch (error) {
      return JSON.stringify(createToolError('finance_get_transactions', error));
    }
  },
});

// =============================================================================
// finance_spending_summary
// =============================================================================

const financeSpendingSummarySchema = z.object({
  period: z.string().default('30d').describe('Time period to analyze: 7d, 30d, 90d, or ytd'),
  limit: z.number().default(10).describe('Number of top categories to return'),
});

export const financeSpendingSummaryTool = tool<typeof financeSpendingSummarySchema, RunContext>({
  name: 'finance_spending_summary',
  description: 'Get a spending breakdown by category for a given time period. Shows where money is going.',
  parameters: financeSpendingSummarySchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const startDate = periodToDate(args.period);

      const supabase = await getSupabaseAdmin();
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('category, amount')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .gt('amount', 0); // expenses only (Plaid: positive = outflow)

      if (error) throw new Error(error.message);

      // Aggregate by category
      const categoryMap = new Map<string, number>();
      let totalSpending = 0;

      for (const tx of data ?? []) {
        const cat = tx.category || 'Uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + tx.amount);
        totalSpending += tx.amount;
      }

      const categories = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount: Math.round(amount * 100) / 100,
          percentage: totalSpending > 0
            ? Math.round((amount / totalSpending) * 1000) / 10
            : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, args.limit);

      return JSON.stringify({
        success: true,
        period: args.period,
        totalSpending: Math.round(totalSpending * 100) / 100,
        categories,
        transactionCount: (data ?? []).length,
      });
    } catch (error) {
      return JSON.stringify(createToolError('finance_spending_summary', error));
    }
  },
});

// =============================================================================
// finance_upcoming_bills
// =============================================================================

const financeUpcomingBillsSchema = z.object({
  days_ahead: z.number().default(30).describe('Number of days to look ahead'),
});

export const financeUpcomingBillsTool = tool<typeof financeUpcomingBillsSchema, RunContext>({
  name: 'finance_upcoming_bills',
  description: 'List upcoming recurring bills and payments with due dates and amounts.',
  parameters: financeUpcomingBillsSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      const supabase = await getSupabaseAdmin();
      const { data, error } = await supabase
        .from('finance_recurring')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('next_date', { ascending: true });

      if (error) throw new Error(error.message);

      const cutoffDate = new Date(Date.now() + args.days_ahead * 24 * 60 * 60 * 1000);
      const bills = (data ?? [])
        .filter(b => {
          if (!b.next_date) return false;
          return new Date(b.next_date) <= cutoffDate;
        })
        .map(b => ({
          id: b.id,
          name: b.merchant_name || b.description,
          amount: b.average_amount,
          frequency: b.frequency,
          nextDate: b.next_date,
          category: b.category,
          lastDate: b.last_date,
        }));

      const totalDue = bills.reduce((sum, b) => sum + (b.amount ?? 0), 0);

      return JSON.stringify({
        success: true,
        bills,
        count: bills.length,
        totalDue: Math.round(totalDue * 100) / 100,
        daysAhead: args.days_ahead,
      });
    } catch (error) {
      return JSON.stringify(createToolError('finance_upcoming_bills', error));
    }
  },
});

// =============================================================================
// finance_net_worth
// =============================================================================

const financeNetWorthSchema = z.object({
  include_history: z.boolean().default(false).describe('Include historical net worth snapshots'),
  history_period: z.string().default('30d').describe('History period if included: 7d, 30d, 90d, or 1y'),
});

export const financeNetWorthTool = tool<typeof financeNetWorthSchema, RunContext>({
  name: 'finance_net_worth',
  description: 'Calculate current net worth from all accounts. Optionally include historical trend data.',
  parameters: financeNetWorthSchema,
  execute: async (args, context) => {
    const userId = getUserId(context);
    if (!userId) return noUserContext();

    try {
      // Get current accounts
      const supabase = await getSupabaseAdmin();
      const { data: accounts, error: accError } = await supabase
        .from('finance_accounts')
        .select('type, balance_current, name, institution_name')
        .eq('user_id', userId)
        .neq('is_hidden', true);

      if (accError) throw new Error(accError.message);

      const assets = (accounts ?? []).filter(a => !['credit', 'loan'].includes(a.type ?? ''));
      const liabilities = (accounts ?? []).filter(a => ['credit', 'loan'].includes(a.type ?? ''));

      const totalAssets = assets.reduce((sum, a) => sum + (a.balance_current ?? 0), 0);
      const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(a.balance_current ?? 0), 0);
      const netWorth = totalAssets - totalLiabilities;

      const result: Record<string, unknown> = {
        success: true,
        netWorth: Math.round(netWorth * 100) / 100,
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
        assetBreakdown: assets.map(a => ({
          name: a.name,
          institution: a.institution_name,
          balance: a.balance_current,
          type: a.type,
        })),
        liabilityBreakdown: liabilities.map(a => ({
          name: a.name,
          institution: a.institution_name,
          balance: Math.abs(a.balance_current ?? 0),
          type: a.type,
        })),
      };

      if (args.include_history) {
        const startDate = periodToDate(args.history_period);
        const { data: snapshots } = await supabase
          .from('finance_snapshots')
          .select('date, total_assets, total_liabilities, net_worth')
          .eq('user_id', userId)
          .gte('date', startDate.toISOString().split('T')[0])
          .order('date', { ascending: true });

        result.history = snapshots ?? [];
      }

      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify(createToolError('finance_net_worth', error));
    }
  },
});

// =============================================================================
// Export all Finance tools
// =============================================================================

// Cast needed: tools are typed with RunContext but agents expect Tool<unknown>
// Context flows through at runtime via run()'s context parameter
export const financeTools = [
  financeGetAccountsTool,
  financeGetTransactionsTool,
  financeSpendingSummaryTool,
  financeUpcomingBillsTool,
  financeNetWorthTool,
] as Tool[];

/**
 * Finance Hub Types
 *
 * Type definitions for the FinanceHub widget and related features
 */

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export type AccountType = 'depository' | 'credit' | 'investment' | 'loan' | 'cash' | 'crypto';

export type AccountSubtype =
  | 'checking'
  | 'savings'
  | 'money_market'
  | 'cd'
  | 'credit_card'
  | 'brokerage'
  | '401k'
  | 'ira'
  | 'roth_ira'
  | 'student'
  | 'mortgage'
  | 'auto'
  | 'personal'
  | 'bitcoin'
  | 'ethereum'
  | 'other';

export type TransactionStatus = 'pending' | 'posted' | 'canceled';

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export type PaymentChannel = 'online' | 'in_store' | 'other';

// Plaid category mapping
export const CATEGORY_ICONS: Record<string, string> = {
  'Food and Drink': '🍔',
  'Shops': '🛍️',
  'Travel': '✈️',
  'Transfer': '💸',
  'Payment': '💳',
  'Recreation': '🎮',
  'Service': '🔧',
  'Community': '🏘️',
  'Healthcare': '🏥',
  'Bank Fees': '🏦',
  'Tax': '📋',
  'Income': '💰',
};

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, { label: string; icon: string; color: string }> = {
  depository: { label: 'Bank Account', icon: '🏦', color: 'text-blue-400' },
  credit: { label: 'Credit Card', icon: '💳', color: 'text-red-400' },
  investment: { label: 'Investment', icon: '📈', color: 'text-green-400' },
  loan: { label: 'Loan', icon: '📋', color: 'text-orange-400' },
  cash: { label: 'Cash', icon: '💵', color: 'text-emerald-400' },
  crypto: { label: 'Crypto', icon: '₿', color: 'text-yellow-400' },
};

// ============================================================
// CORE INTERFACES
// ============================================================

export interface FinanceAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  subtype?: AccountSubtype;
  institutionName?: string;
  institutionId?: string;
  balanceCurrent: number;
  balanceAvailable?: number;
  balanceLimit?: number;
  currency: string;
  // Plaid fields
  plaidItemId?: string;
  plaidAccountId?: string;
  // SnapTrade fields
  snaptradeConnectionId?: string;
  snaptradeAccountId?: string;
  // Status
  isManual: boolean;
  isHidden: boolean;
  lastSyncedAt?: string;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number; // Negative = expense, Positive = income
  date: string; // YYYY-MM-DD
  datetime?: string;
  merchantName?: string;
  description?: string;
  category: string[];
  categoryId?: string;
  // Source tracking
  plaidTransactionId?: string;
  isManual: boolean;
  isRecurring: boolean;
  recurringId?: string;
  // Status
  status: TransactionStatus;
  isTransfer: boolean;
  transferPairId?: string;
  // Metadata
  logoUrl?: string;
  website?: string;
  location?: TransactionLocation;
  paymentChannel?: PaymentChannel;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionLocation {
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  address?: string;
  postalCode?: string;
}

export interface RecurringItem {
  id: string;
  userId: string;
  accountId?: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  category: string[];
  // Schedule
  startDate: string;
  nextDueDate: string;
  endDate?: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  // Behavior
  autoConfirm: boolean;
  reminderDays: number;
  isIncome: boolean;
  isActive: boolean;
  // Tracking
  lastConfirmedDate?: string;
  missedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSnapshot {
  id: string;
  userId: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidAssets: number;
  investments: number;
  breakdown?: {
    depository?: number;
    credit?: number;
    investment?: number;
    loan?: number;
    cash?: number;
    crypto?: number;
  };
  createdAt: string;
}

export interface FinanceBudget {
  id: string;
  userId: string;
  name: string;
  category: string[];
  amount: number;
  period: BudgetPeriod;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface PlaidLinkTokenResponse {
  linkToken: string;
  expiration: string;
}

export interface PlaidExchangeResponse {
  success: boolean;
  itemId: string;
  accounts: FinanceAccount[];
}

export interface SyncResult {
  success: boolean;
  accountsUpdated: number;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  error?: string;
}

export interface SpendingSummary {
  period: string;
  totalSpent: number;
  totalIncome: number;
  netChange: number;
  byCategory: {
    category: string;
    amount: number;
    count: number;
    percentOfTotal: number;
  }[];
  byAccount: {
    accountId: string;
    accountName: string;
    amount: number;
  }[];
}

export interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
  category: string[];
  accountName?: string;
}

// ============================================================
// SIMULATION TYPES
// ============================================================

export interface SimulationParams {
  years: number;
  monthlyContribution: number;
  expectedReturn: number; // 0.07 = 7%
  inflationRate?: number;
  majorPurchases?: {
    amount: number;
    year: number;
    description: string;
  }[];
  retirementAge?: number;
  currentAge?: number;
}

export interface SimulationResult {
  years: number[];
  baseline: number[]; // Current trajectory
  scenario: number[]; // With changes applied
  finalNetWorth: number;
  totalContributed: number;
  totalGrowth: number;
  projectedRetirementAge?: number;
  confidenceInterval?: {
    low: number[];
    high: number[];
  };
}

// ============================================================
// UI STATE TYPES
// ============================================================

export type FinanceTab = 'ledger' | 'recurring' | 'simulator' | 'insights';

export interface DateRange {
  start: string;
  end: string;
}

export interface TransactionFilters {
  accountIds?: string[];
  categories?: string[];
  status?: TransactionStatus[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  dateRange?: DateRange;
  isRecurring?: boolean;
}

export interface FinanceAlert {
  id: string;
  type: 'bill_due' | 'anomaly' | 'budget_exceeded' | 'low_balance' | 'market_change';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  dismissedAt?: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

export function formatCompactCurrency(amount: number, currency: string = 'USD'): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (absAmount >= 1_000_000) {
    return `${sign}$${(absAmount / 1_000_000).toFixed(1)}M`;
  }
  if (absAmount >= 1_000) {
    return `${sign}$${(absAmount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount, currency);
}

export function getCategoryIcon(category: string | string[]): string {
  const mainCategory = Array.isArray(category) 
    ? category[0] || 'Other'
    : category.split(',')[0]?.trim() || category;
  return CATEGORY_ICONS[mainCategory] || '📦';
}

export function getAccountTypeConfig(type: AccountType) {
  return ACCOUNT_TYPE_CONFIG[type] || ACCOUNT_TYPE_CONFIG.cash;
}

export function isAssetAccount(type: AccountType): boolean {
  return ['depository', 'investment', 'cash', 'crypto'].includes(type);
}

export function isLiabilityAccount(type: AccountType): boolean {
  return ['credit', 'loan'].includes(type);
}

export function calculateNetWorth(accounts: FinanceAccount[]): {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  liquidAssets: number;
  investments: number;
} {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let liquidAssets = 0;
  let investments = 0;

  for (const account of accounts) {
    if (account.isHidden) continue;
    
    if (isAssetAccount(account.type)) {
      totalAssets += account.balanceCurrent;
      if (account.type === 'depository' || account.type === 'cash') {
        liquidAssets += account.balanceCurrent;
      }
      if (account.type === 'investment' || account.type === 'crypto') {
        investments += account.balanceCurrent;
      }
    } else {
      totalLiabilities += Math.abs(account.balanceCurrent);
    }
  }

  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
    liquidAssets,
    investments,
  };
}

export function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getNextDueDate(
  frequency: RecurringFrequency,
  lastDate: string,
  dayOfMonth?: number,
  dayOfWeek?: number
): string {
  const date = new Date(lastDate);
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      if (dayOfMonth) {
        date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split('T')[0] as string;
}

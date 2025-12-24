-- ============================================================
-- FINANCE HUB MIGRATION
-- Run this in Supabase SQL Editor to create finance tables
-- ============================================================

-- Finance Accounts Table
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('depository', 'credit', 'investment', 'loan', 'cash', 'crypto', 'property', 'vehicle', 'other')),
  subtype TEXT,
  institution_name TEXT,
  institution_id TEXT,
  balance_current NUMERIC(15, 2) DEFAULT 0,
  balance_available NUMERIC(15, 2),
  balance_limit NUMERIC(15, 2),
  currency TEXT DEFAULT 'USD',
  plaid_access_token_encrypted TEXT,
  plaid_item_id TEXT,
  plaid_account_id TEXT UNIQUE,
  snaptrade_connection_id TEXT,
  snaptrade_account_id TEXT,
  is_manual BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_user ON finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_plaid_item ON finance_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_plaid_account ON finance_accounts(plaid_account_id);

-- Finance Transactions Table
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE NOT NULL,
  datetime TIMESTAMPTZ,
  merchant_name TEXT,
  description TEXT,
  category TEXT[] DEFAULT '{}',
  category_id TEXT,
  plaid_transaction_id TEXT UNIQUE,
  is_manual BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,
  status TEXT DEFAULT 'posted' CHECK (status IN ('pending', 'posted')),
  is_transfer BOOLEAN DEFAULT false,
  logo_url TEXT,
  website TEXT,
  location JSONB,
  payment_channel TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_user ON finance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_plaid ON finance_transactions(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON finance_transactions USING GIN(category);

-- Finance Recurring Items Table
CREATE TABLE IF NOT EXISTS finance_recurring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  category TEXT[] DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE,
  next_due_date DATE NOT NULL,
  last_paid_date DATE,
  auto_confirm BOOLEAN DEFAULT false,
  reminder_days INTEGER DEFAULT 3,
  is_income BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  missed_count INTEGER DEFAULT 0,
  account_id UUID REFERENCES finance_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_recurring_user ON finance_recurring(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_next_due ON finance_recurring(next_due_date);

-- Finance Snapshots Table (Daily net worth tracking)
CREATE TABLE IF NOT EXISTS finance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  total_assets NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_worth NUMERIC(15, 2) NOT NULL DEFAULT 0,
  liquid_assets NUMERIC(15, 2) DEFAULT 0,
  investments NUMERIC(15, 2) DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_finance_snapshots_user ON finance_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_snapshots_date ON finance_snapshots(date DESC);

-- Updated_at triggers for finance tables
CREATE OR REPLACE TRIGGER update_finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_finance_recurring_updated_at
  BEFORE UPDATE ON finance_recurring
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime for finance tables (ignore errors if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE finance_accounts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE finance_transactions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

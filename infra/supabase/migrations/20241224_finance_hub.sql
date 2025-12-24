-- ============================================================
-- FINANCE HUB SYSTEM
-- Migration: 20241224_finance_hub.sql
-- ============================================================

-- Finance Recurring (must be created first for FK reference)
CREATE TABLE IF NOT EXISTS finance_recurring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID, -- Will add FK after finance_accounts exists
  name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  category TEXT[],
  -- Schedule
  start_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  end_date DATE, -- NULL = indefinite
  day_of_month INTEGER, -- 1-31 for monthly
  day_of_week INTEGER, -- 0-6 for weekly
  -- Behavior
  auto_confirm BOOLEAN DEFAULT false,
  reminder_days INTEGER DEFAULT 3,
  is_income BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  -- Tracking
  last_confirmed_date DATE,
  missed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Finance Accounts (Linked institutions + manual wallets)
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('depository', 'credit', 'investment', 'loan', 'cash', 'crypto')),
  subtype TEXT,
  institution_name TEXT,
  institution_id TEXT,
  balance_current DECIMAL(15,2) DEFAULT 0,
  balance_available DECIMAL(15,2),
  balance_limit DECIMAL(15,2),
  currency TEXT DEFAULT 'USD',
  -- Plaid fields (encrypted)
  plaid_access_token_encrypted TEXT,
  plaid_item_id TEXT,
  plaid_account_id TEXT,
  -- SnapTrade fields
  snaptrade_connection_id TEXT,
  snaptrade_account_id TEXT,
  -- Status
  is_manual BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK to finance_recurring after finance_accounts exists
ALTER TABLE finance_recurring 
  ADD CONSTRAINT fk_recurring_account 
  FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL;

-- Finance Transactions (Unified ledger)
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  datetime TIMESTAMPTZ,
  merchant_name TEXT,
  description TEXT,
  category TEXT[],
  category_id TEXT,
  -- Source tracking
  plaid_transaction_id TEXT UNIQUE,
  is_manual BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID REFERENCES finance_recurring(id),
  -- Status
  status TEXT DEFAULT 'posted' CHECK (status IN ('pending', 'posted', 'canceled')),
  is_transfer BOOLEAN DEFAULT false,
  transfer_pair_id UUID,
  -- Metadata
  logo_url TEXT,
  website TEXT,
  location JSONB,
  payment_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Finance Snapshots (Daily net worth history)
CREATE TABLE IF NOT EXISTS finance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_assets DECIMAL(15,2) NOT NULL,
  total_liabilities DECIMAL(15,2) NOT NULL,
  net_worth DECIMAL(15,2) NOT NULL,
  liquid_assets DECIMAL(15,2) NOT NULL,
  investments DECIMAL(15,2) DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Finance Budgets
CREATE TABLE IF NOT EXISTS finance_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT[],
  amount DECIMAL(15,2) NOT NULL,
  period TEXT DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finance_accounts_user_id ON finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_type ON finance_accounts(type);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_plaid_item ON finance_accounts(plaid_item_id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_id ON finance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account_id ON finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON finance_transactions USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_plaid ON finance_transactions(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_recurring ON finance_transactions(recurring_id);

CREATE INDEX IF NOT EXISTS idx_finance_recurring_user_id ON finance_recurring(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_next_due ON finance_recurring(next_due_date) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_finance_snapshots_user_date ON finance_snapshots(user_id, date DESC);

-- RLS Policies
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recurring ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users manage own finance_accounts" ON finance_accounts;
DROP POLICY IF EXISTS "Users manage own finance_transactions" ON finance_transactions;
DROP POLICY IF EXISTS "Users manage own finance_recurring" ON finance_recurring;
DROP POLICY IF EXISTS "Users manage own finance_snapshots" ON finance_snapshots;
DROP POLICY IF EXISTS "Users manage own finance_budgets" ON finance_budgets;

CREATE POLICY "Users manage own finance_accounts" ON finance_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_transactions" ON finance_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_recurring" ON finance_recurring FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_snapshots" ON finance_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own finance_budgets" ON finance_budgets FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE finance_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE finance_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE finance_recurring;

-- Triggers (use existing update_updated_at_column function from main schema)
DROP TRIGGER IF EXISTS update_finance_accounts_updated_at ON finance_accounts;
DROP TRIGGER IF EXISTS update_finance_transactions_updated_at ON finance_transactions;
DROP TRIGGER IF EXISTS update_finance_recurring_updated_at ON finance_recurring;
DROP TRIGGER IF EXISTS update_finance_budgets_updated_at ON finance_budgets;

CREATE TRIGGER update_finance_accounts_updated_at 
  BEFORE UPDATE ON finance_accounts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_transactions_updated_at 
  BEFORE UPDATE ON finance_transactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_recurring_updated_at 
  BEFORE UPDATE ON finance_recurring 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finance_budgets_updated_at 
  BEFORE UPDATE ON finance_budgets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

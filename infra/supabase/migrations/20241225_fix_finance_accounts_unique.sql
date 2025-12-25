-- ============================================================
-- FIX: Add unique constraints to prevent account duplication
-- Migration: 20241225_fix_finance_accounts_unique.sql
-- ============================================================

-- Step 1: Clean up any existing duplicate Plaid accounts (keep oldest)
DELETE FROM finance_accounts a
USING finance_accounts b
WHERE a.plaid_account_id = b.plaid_account_id
  AND a.plaid_account_id IS NOT NULL
  AND a.created_at > b.created_at;

-- Step 2: Clean up any existing duplicate SnapTrade accounts (keep oldest)
DELETE FROM finance_accounts a
USING finance_accounts b
WHERE a.snaptrade_account_id = b.snaptrade_account_id
  AND a.snaptrade_account_id IS NOT NULL
  AND a.created_at > b.created_at;

-- Step 3: Add unique constraint for Plaid account IDs
-- This ensures upsert with onConflict: 'plaid_account_id' works correctly
ALTER TABLE finance_accounts 
DROP CONSTRAINT IF EXISTS finance_accounts_plaid_account_id_key;

ALTER TABLE finance_accounts 
ADD CONSTRAINT finance_accounts_plaid_account_id_key 
UNIQUE (plaid_account_id);

-- Step 4: Add unique constraint for SnapTrade account IDs
ALTER TABLE finance_accounts 
DROP CONSTRAINT IF EXISTS finance_accounts_snaptrade_account_id_key;

ALTER TABLE finance_accounts 
ADD CONSTRAINT finance_accounts_snaptrade_account_id_key 
UNIQUE (snaptrade_account_id);

-- Step 5: Create index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_finance_accounts_plaid_account_id 
ON finance_accounts(plaid_account_id) 
WHERE plaid_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_accounts_snaptrade_account_id 
ON finance_accounts(snaptrade_account_id) 
WHERE snaptrade_account_id IS NOT NULL;

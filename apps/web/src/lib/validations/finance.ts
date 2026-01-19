/**
 * Finance API validation schemas
 */
import { z } from 'zod';

export const accountTypeEnum = z.enum([
  'depository',
  'credit',
  'investment',
  'loan',
  'cash',
  'crypto',
  'property',
  'vehicle',
  'other',
]);

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: accountTypeEnum,
  subtype: z.string().max(50).optional(),
  institutionName: z.string().max(100).optional(),
  balanceCurrent: z.number().optional(),
  balanceLimit: z.number().optional(),
  currency: z.string().length(3).default('USD'),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: accountTypeEnum.optional(),
  subtype: z.string().max(50).optional(),
  institutionName: z.string().max(100).optional(),
  balanceCurrent: z.number().optional(),
  balanceLimit: z.number().optional(),
  currency: z.string().length(3).optional(),
  isHidden: z.boolean().optional(),
});

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number(),
  date: z.string().datetime(),
  merchantName: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  category: z.array(z.string()).optional(),
  pending: z.boolean().default(false),
});

export const updateTransactionSchema = z.object({
  merchantName: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  category: z.array(z.string()).optional(),
});

export const plaidLinkTokenSchema = z.object({
  userId: z.string().uuid().optional(), // Will use authenticated user
});

export const plaidExchangeSchema = z.object({
  publicToken: z.string().min(1, 'Public token is required'),
  institutionId: z.string().optional(),
  institutionName: z.string().optional(),
});

export const snaptradeConnectSchema = z.object({
  broker: z.string().optional(),
  redirectUri: z.string().url().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type PlaidLinkTokenInput = z.infer<typeof plaidLinkTokenSchema>;
export type PlaidExchangeInput = z.infer<typeof plaidExchangeSchema>;
export type SnaptradeConnectInput = z.infer<typeof snaptradeConnectSchema>;

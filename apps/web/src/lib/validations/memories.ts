/**
 * Memories API validation schemas
 */
import { z } from 'zod';

export const memoryTypeEnum = z.enum([
  'preference',
  'context',
  'instruction',
  'fact',
  'conversation',
  'task',
  'emotion',
  'feedback',
]);

export const importanceEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const createMemorySchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  memoryType: memoryTypeEnum,
  importance: importanceEnum.default('medium'),
  sourceThreadId: z.string().uuid().optional(),
  sourceMessageId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const updateMemorySchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  memoryType: memoryTypeEnum.optional(),
  importance: importanceEnum.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const searchMemoriesSchema = z.object({
  query: z.string().max(500).optional(),
  memoryType: memoryTypeEnum.optional(),
  importance: importanceEnum.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const extractMemoriesSchema = z.object({
  messageContent: z.string().min(1).max(50000),
  threadId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type SearchMemoriesInput = z.infer<typeof searchMemoriesSchema>;
export type ExtractMemoriesInput = z.infer<typeof extractMemoriesSchema>;

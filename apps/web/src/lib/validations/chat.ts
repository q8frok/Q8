/**
 * Chat API validation schemas
 */
import { z } from 'zod';

export const communicationStyleEnum = z.enum(['concise', 'detailed']);

export const userProfileSchema = z.object({
  name: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  communicationStyle: communicationStyleEnum.optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(50000),
  userId: z.string().uuid().optional(), // Will use authenticated user
  conversationId: z.string().max(100).optional(),
  userProfile: userProfileSchema.optional(),
});

export const chatStreamSchema = z.object({
  message: z.string().min(1, 'Message is required').max(50000),
  conversationId: z.string().max(100).optional(),
  model: z.string().max(50).optional(),
});

export const createThreadSchema = z.object({
  title: z.string().max(500).optional(),
  agentId: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().max(500).optional(),
  summary: z.string().max(2000).optional(),
  is_archived: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const threadSummarizeSchema = z.object({
  maxLength: z.number().int().min(50).max(2000).default(500),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatStreamInput = z.infer<typeof chatStreamSchema>;
export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
export type ThreadSummarizeInput = z.infer<typeof threadSummarizeSchema>;

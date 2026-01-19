/**
 * Thread API validation schemas
 */
import { z } from 'zod';

export const messageRoleEnum = z.enum(['user', 'assistant', 'system', 'tool']);

export const messageSchema = z.object({
  role: messageRoleEnum,
  content: z.string().max(100000, 'Message too long'),
  name: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createThreadWithMessagesSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  messages: z.array(messageSchema).optional(),
  agentId: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateThreadFullSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export const addMessageSchema = z.object({
  role: messageRoleEnum,
  content: z.string().min(1, 'Content is required').max(100000, 'Message too long'),
  name: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const threadQuerySchema = z.object({
  agentId: z.string().max(100).optional(),
  isArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type CreateThreadWithMessagesInput = z.infer<typeof createThreadWithMessagesSchema>;
export type UpdateThreadFullInput = z.infer<typeof updateThreadFullSchema>;
export type AddMessageInput = z.infer<typeof addMessageSchema>;
export type ThreadQueryInput = z.infer<typeof threadQuerySchema>;
export type MessageInput = z.infer<typeof messageSchema>;

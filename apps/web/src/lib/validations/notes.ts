/**
 * Notes API validation schemas
 */
import { z } from 'zod';

export const noteColorEnum = z.enum([
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'gray',
]).optional();

export const actionItemSchema = z.object({
  id: z.string(),
  task: z.string(),
  completed: z.boolean(),
  due_date: z.string().nullable(),
  created_at: z.string(),
});

export const createNoteSchema = z.object({
  title: z.string().max(500).default('Untitled'),
  content: z.string().optional(),
  contentJson: z.record(z.unknown()).optional(),
  folderId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean().default(false),
  isLocked: z.boolean().default(false),
  color: noteColorEnum,
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  contentJson: z.record(z.unknown()).optional(),
  folderId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  color: noteColorEnum,
  tags: z.array(z.string().max(50)).max(20).optional(),
  aiSummary: z.string().optional(),
  aiActionItems: z.array(actionItemSchema).optional(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100),
  parentId: z.string().uuid().nullable().optional(),
  color: noteColorEnum,
  icon: z.string().max(50).optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  color: noteColorEnum,
  icon: z.string().max(50).optional(),
});

export const searchNotesSchema = z.object({
  query: z.string().max(200),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type SearchNotesInput = z.infer<typeof searchNotesSchema>;

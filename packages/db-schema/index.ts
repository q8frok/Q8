/**
 * Shared Database Schemas - Single Source of Truth
 * 
 * This package defines all entity schemas using Zod.
 * Both RxDB and Supabase schemas are derived from these definitions.
 * 
 * IMPORTANT: When modifying schemas:
 * 1. Update the Zod schema here first
 * 2. Run `pnpm validate-schemas` to check for drift
 * 3. Generate migration if needed: `pnpm generate-migration`
 */

import { z } from 'zod';

// =============================================================================
// COMMON TYPES
// =============================================================================

export const timestampFields = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

// =============================================================================
// USERS
// =============================================================================

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  ...timestampFields,
});

// =============================================================================
// CHAT MESSAGES
// =============================================================================

export const chatMessageRoleSchema = z.enum([
  'user',
  'assistant',
  'system',
  'orchestrator',
  'coder',
  'researcher',
  'secretary',
  'personality',
]);

export const chatMessageStatusSchema = z.enum(['sending', 'sent', 'error']);

export const chatMessageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  threadId: z.string().optional(),
  conversationId: z.string().optional(),
  role: chatMessageRoleSchema,
  content: z.string(),
  agentName: z.string().optional(),
  avatar: z.string().optional(),
  status: chatMessageStatusSchema.optional(),
  toolExecutions: z.array(z.record(z.unknown())).optional(),
  metadata: z.record(z.unknown()).optional(),
  ...timestampFields,
});

// =============================================================================
// THREADS
// =============================================================================

export const threadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().optional(),
  summary: z.string().optional(),
  isArchived: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
  lastMessageAt: z.string().datetime(),
  ...timestampFields,
});

// =============================================================================
// TASKS
// =============================================================================

export const taskStatusSchema = z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']);
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const taskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: taskStatusSchema.default('todo'),
  priority: taskPrioritySchema.default('medium'),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
  projectId: z.string().optional(),
  parentTaskId: z.string().optional(),
  sortOrder: z.number().default(0),
  estimatedMinutes: z.number().optional(),
  completedAt: z.string().datetime().optional(),
  ...timestampFields,
});

// =============================================================================
// NOTES
// =============================================================================

export const actionItemSchema = z.object({
  id: z.string(),
  task: z.string(),
  completed: z.boolean().default(false),
  dueDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export const noteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().optional(),
  content: z.string().default(''),
  contentJson: z.record(z.unknown()).optional(),
  folderId: z.string().optional(),
  isPinned: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  isLocked: z.boolean().default(false),
  isDaily: z.boolean().default(false),
  dailyDate: z.string().optional(), // YYYY-MM-DD format
  color: z.string().optional(),
  tags: z.array(z.string()).default([]),
  wordCount: z.number().default(0),
  aiSummary: z.string().optional(),
  aiActionItems: z.array(actionItemSchema).optional(),
  lastEditedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
  ...timestampFields,
});

// =============================================================================
// NOTE FOLDERS
// =============================================================================

export const noteFolderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().default(0),
  ...timestampFields,
});

// =============================================================================
// AGENT MEMORIES
// =============================================================================

export const memoryTypeSchema = z.enum(['fact', 'preference', 'task', 'event', 'relationship']);
export const memoryImportanceSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const verificationStatusSchema = z.enum(['unverified', 'verified', 'contradicted']);

export const agentMemorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: z.string(),
  memoryType: memoryTypeSchema,
  importance: memoryImportanceSchema.default('medium'),
  sourceThreadId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
  accessCount: z.number().default(0),
  lastAccessedAt: z.string().datetime().optional(),
  decayFactor: z.number().default(1.0),
  verificationStatus: verificationStatusSchema.default('unverified'),
  supersededBy: z.string().optional(),
  provenance: z.record(z.unknown()).default({}),
  ...timestampFields,
});

// =============================================================================
// USER PREFERENCES
// =============================================================================

export const userPreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  dashboardLayout: z.record(z.unknown()).optional(),
  preferredAgent: z.string().optional(),
  updatedAt: z.string().datetime(),
});

// =============================================================================
// DEVICES
// =============================================================================

export const deviceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  type: z.string(),
  state: z.string(),
  attributes: z.record(z.unknown()).optional(),
  updatedAt: z.string().datetime(),
});

// =============================================================================
// KNOWLEDGE BASE
// =============================================================================

export const knowledgeBaseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: z.string(),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
  ...timestampFields,
});

// =============================================================================
// GITHUB PRS
// =============================================================================

export const githubPRSchema = z.object({
  id: z.string(),
  userId: z.string(),
  number: z.number(),
  title: z.string(),
  status: z.string(),
  author: z.string(),
  repo: z.string(),
  url: z.string().url(),
  ...timestampFields,
});

// =============================================================================
// CALENDAR EVENTS
// =============================================================================

export const calendarEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional(),
  attendeesCount: z.number().optional(),
  color: z.string().optional(),
  calendarName: z.string(),
  ...timestampFields,
});

// =============================================================================
// SYNC CHECKPOINTS
// =============================================================================

export const syncCheckpointSchema = z.object({
  id: z.string(),
  userId: z.string(),
  collectionName: z.string(),
  lastPulledAt: z.string().datetime().optional(),
  lastPushedAt: z.string().datetime().optional(),
  serverVersion: z.string().optional(),
  ...timestampFields,
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type User = z.infer<typeof userSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>;
export type Thread = z.infer<typeof threadSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type Note = z.infer<typeof noteSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;
export type NoteFolder = z.infer<typeof noteFolderSchema>;
export type AgentMemory = z.infer<typeof agentMemorySchema>;
export type MemoryType = z.infer<typeof memoryTypeSchema>;
export type MemoryImportance = z.infer<typeof memoryImportanceSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type GithubPR = z.infer<typeof githubPRSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type SyncCheckpoint = z.infer<typeof syncCheckpointSchema>;

// =============================================================================
// SCHEMA REGISTRY
// =============================================================================

/**
 * Registry of all schemas for validation and code generation
 */
export const SCHEMA_REGISTRY = {
  users: userSchema,
  chat_messages: chatMessageSchema,
  threads: threadSchema,
  tasks: taskSchema,
  notes: noteSchema,
  note_folders: noteFolderSchema,
  agent_memories: agentMemorySchema,
  user_preferences: userPreferencesSchema,
  devices: deviceSchema,
  knowledge_base: knowledgeBaseSchema,
  github_prs: githubPRSchema,
  calendar_events: calendarEventSchema,
  sync_checkpoints: syncCheckpointSchema,
} as const;

export type SchemaName = keyof typeof SCHEMA_REGISTRY;

/**
 * Get schema by collection name
 */
export function getSchema(name: SchemaName) {
  return SCHEMA_REGISTRY[name];
}

/**
 * Validate a document against its schema
 */
export function validateDocument<T extends SchemaName>(
  collectionName: T,
  document: unknown
): { success: boolean; data?: z.infer<typeof SCHEMA_REGISTRY[T]>; error?: z.ZodError } {
  const schema = SCHEMA_REGISTRY[collectionName];
  const result = schema.safeParse(document);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

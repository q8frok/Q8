/**
 * @q8/types - Shared TypeScript types for Q8 monorepo
 *
 * This package provides type definitions used across the Q8 application:
 * - User and authentication types
 * - Message and conversation types
 * - Agent and orchestration types
 * - Widget and dashboard types
 * - API response types
 */

// =============================================================================
// USER & AUTH
// =============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: 'user' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  userId: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// =============================================================================
// AGENTS
// =============================================================================

export type AgentType =
  | 'orchestrator'
  | 'coder'
  | 'researcher'
  | 'secretary'
  | 'personality'
  | 'home'
  | 'finance'
  | 'imagegen';

export interface Agent {
  name: string;
  type: AgentType;
  model: string;
  capabilities: string[];
  description?: string;
}

export interface AgentMetrics {
  agent: AgentType;
  successRate: number;
  avgLatency: number;
  totalRequests: number;
  recentFailures: number;
}

// =============================================================================
// MESSAGES & CONVERSATIONS
// =============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | AgentType;

export type MessageStatus = 'sending' | 'sent' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  agentName?: string;
  avatar?: string;
  status?: MessageStatus;
  timestamp: Date | string;
  toolExecutions?: ToolExecution[];
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  messages: Message[];
  isArchived?: boolean;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Thread {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  isArchived: boolean;
  metadata: Record<string, unknown>;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// TOOLS
// =============================================================================

export interface ToolExecution {
  id: string;
  toolName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category?: string;
}

// =============================================================================
// TASKS
// =============================================================================

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  tags: string[];
  projectId?: string;
  parentTaskId?: string;
  sortOrder: number;
  estimatedMinutes?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// NOTES
// =============================================================================

export interface ActionItem {
  id: string;
  task: string;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title?: string;
  content: string;
  contentJson?: Record<string, unknown>;
  folderId?: string;
  isPinned: boolean;
  isArchived: boolean;
  isLocked: boolean;
  isDaily: boolean;
  dailyDate?: string;
  color?: string;
  tags: string[];
  wordCount: number;
  aiSummary?: string;
  aiActionItems?: ActionItem[];
  lastEditedAt: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolder {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// FINANCE
// =============================================================================

export interface FinanceAccount {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'other';
  institutionName?: string;
  balance: number;
  currency: string;
  isHidden: boolean;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  date: string;
  merchantName?: string;
  description?: string;
  category?: string[];
  isManual: boolean;
  isRecurring: boolean;
  status: 'pending' | 'posted';
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// CALENDAR
// =============================================================================

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  meetingUrl?: string;
  attendeesCount?: number;
  color?: string;
  calendarName: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// WIDGETS & DASHBOARD
// =============================================================================

export type WidgetType =
  | 'clock'
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'finance'
  | 'github'
  | 'smart-home'
  | 'content'
  | 'weather';

export type DashboardMode = 'productivity' | 'personal' | 'development' | 'custom';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  colSpan: number;
  rowSpan: number;
  order: number;
  settings?: Record<string, unknown>;
}

export interface DashboardLayout {
  mode: DashboardMode;
  widgets: WidgetConfig[];
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// SYNC
// =============================================================================

export type SyncCollection =
  | 'tasks'
  | 'notes'
  | 'threads'
  | 'chat_messages'
  | 'user_preferences'
  | 'devices'
  | 'sync_checkpoints';

export interface SyncCheckpoint {
  id: string;
  userId: string;
  collectionName: SyncCollection;
  lastPulledAt?: string;
  lastPushedAt?: string;
  serverVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  collection: SyncCollection;
  documentId: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

// =============================================================================
// VOICE
// =============================================================================

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceState {
  status: VoiceStatus;
  isConnected: boolean;
  isMuted: boolean;
  transcript?: string;
  error?: string;
}

// =============================================================================
// ROUTING & ORCHESTRATION
// =============================================================================

export type RoutingSource = 'heuristic' | 'llm' | 'vector' | 'fallback';

export interface RoutingDecision {
  targetAgent: AgentType;
  confidence: number;
  source: RoutingSource;
  reasoning?: string;
}

export interface HandoffContext {
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: string;
  preserveContext: boolean;
  metadata?: Record<string, unknown>;
}

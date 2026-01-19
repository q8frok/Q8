/**
 * Sync Constants
 * Centralized configuration for sync operations
 */

/**
 * Collections that support bidirectional sync with Supabase
 * Order matters: higher priority collections are synced first
 */
export const SYNCABLE_COLLECTIONS = [
  'chat_messages',
  'tasks',
  'notes',
  'note_folders',
  'threads',
  'agent_memories',
  'user_preferences',
  'devices',
  'knowledge_base',
  'github_prs',
  'calendar_events',
] as const;

export type SyncableCollection = typeof SYNCABLE_COLLECTIONS[number];

/**
 * Collection sync direction configuration
 */
export const COLLECTION_SYNC_DIRECTION: Record<SyncableCollection, 'bidirectional' | 'pull-only' | 'push-only'> = {
  chat_messages: 'bidirectional',
  tasks: 'bidirectional',
  notes: 'bidirectional',
  note_folders: 'bidirectional',
  threads: 'bidirectional',
  agent_memories: 'bidirectional',
  user_preferences: 'bidirectional',
  devices: 'pull-only',
  knowledge_base: 'push-only',
  github_prs: 'pull-only',
  calendar_events: 'pull-only',
};

/**
 * Collection priority for sync ordering
 * Higher number = higher priority (synced first)
 */
export const COLLECTION_PRIORITY: Record<SyncableCollection, number> = {
  chat_messages: 100,
  tasks: 95,
  notes: 90,
  threads: 85,
  note_folders: 80,
  agent_memories: 75,
  user_preferences: 70,
  calendar_events: 60,
  github_prs: 50,
  devices: 40,
  knowledge_base: 30,
};

/**
 * Collection batch sizes for sync operations
 */
export const COLLECTION_BATCH_SIZE: Record<SyncableCollection, number> = {
  chat_messages: 50,
  tasks: 100,
  notes: 20,
  note_folders: 50,
  threads: 50,
  agent_memories: 50,
  user_preferences: 1,
  devices: 50,
  knowledge_base: 10,
  github_prs: 100,
  calendar_events: 200,
};

/**
 * Supabase table names (snake_case) mapped from RxDB collection names
 */
export const SUPABASE_TABLE_NAMES: Record<SyncableCollection, string> = {
  chat_messages: 'chat_messages',
  tasks: 'tasks',
  notes: 'notes',
  note_folders: 'note_folders',
  threads: 'threads',
  agent_memories: 'agent_memories',
  user_preferences: 'user_preferences',
  devices: 'devices',
  knowledge_base: 'knowledge_base',
  github_prs: 'github_prs',
  calendar_events: 'calendar_events',
};

/**
 * Default sync configuration
 */
export const SYNC_CONFIG = {
  /** Default batch size for pull/push operations */
  defaultBatchSize: 100,
  /** Polling interval in milliseconds for real-time fallback */
  pollingIntervalMs: 10000,
  /** Maximum retry attempts for failed sync operations */
  maxRetries: 3,
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: 1000,
  /** Maximum delay for exponential backoff (ms) */
  maxRetryDelayMs: 30000,
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: 5,
  /** Circuit breaker reset timeout (ms) */
  circuitBreakerResetMs: 30000,
  /** Debounce delay for push operations (ms) */
  pushDebounceMs: 500,
  /** Enable real-time subscriptions */
  enableRealtime: true,
} as const;

/**
 * Get sorted collections by priority (highest first)
 */
export function getCollectionsByPriority(): SyncableCollection[] {
  return [...SYNCABLE_COLLECTIONS].sort(
    (a, b) => COLLECTION_PRIORITY[b] - COLLECTION_PRIORITY[a]
  );
}

/**
 * Check if a collection supports push operations
 */
export function canPush(collection: SyncableCollection): boolean {
  const direction = COLLECTION_SYNC_DIRECTION[collection];
  return direction === 'bidirectional' || direction === 'push-only';
}

/**
 * Check if a collection supports pull operations
 */
export function canPull(collection: SyncableCollection): boolean {
  const direction = COLLECTION_SYNC_DIRECTION[collection];
  return direction === 'bidirectional' || direction === 'pull-only';
}

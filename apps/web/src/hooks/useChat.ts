/**
 * useChat Hook
 * Streaming chat with tool execution visibility
 *
 * Integrates:
 * - Server-canonical history (no client-side conversationHistory sent)
 * - Run lifecycle state (run_created / run_state)
 * - Client requestId for idempotency
 * - Versioned event parsing with forward-compatibility
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { EVENT_SCHEMA_VERSION, hasSupportedEventVersion } from '@/lib/agents/sdk/events';

export type AgentType = 'orchestrator' | 'coder' | 'researcher' | 'secretary' | 'personality' | 'home' | 'finance' | 'imagegen';

// =============================================================================
// VERSIONED EVENT PARSING (PR #12)
// =============================================================================

type ParsedStreamEvent = {
  type: string;
  eventVersion?: number;
  runId?: string;
  requestId?: string;
  timestamp?: string;
  correlationId?: string;
  agent?: AgentType;
  reason?: string;
  confidence?: number;
  source?: string;
  from?: AgentType;
  to?: AgentType;
  tool?: string;
  id?: string;
  args?: Record<string, unknown>;
  success?: boolean;
  result?: unknown;
  duration?: number;
  delta?: string;
  fullContent?: string;
  message?: string;
  recoverable?: boolean;
  threadId?: string;
  count?: number;
  url?: string;
  relevance?: number;
  memoryId?: string;
  content?: string;
  imageData?: string;
  mimeType?: string;
  caption?: string;
  model?: string;
  analysis?: string;
  imageUrl?: string;
  images?: Array<{ data: string; mimeType: string; caption?: string }>;
  text?: string;
  isComplete?: boolean;
  widgetId?: string;
  action?: string;
  data?: Record<string, unknown>;
  state?: string;
  [key: string]: unknown;
};

const KNOWN_EVENT_TYPES = new Set([
  'thread_created',
  'memory_extracted',
  'routing',
  'agent_start',
  'handoff',
  'tool_start',
  'tool_end',
  'citation',
  'memory_used',
  'image_generated',
  'image_analyzed',
  'tts_chunk',
  'widget_action',
  'content',
  'done',
  'error',
  'run_created',
  'run_state',
  'reasoning_start',
  'reasoning_end',
  'guardrail_triggered',
  'interruption_required',
  'interruption_resolved',
]);

function parseVersionedEvent(raw: unknown): ParsedStreamEvent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const event = raw as ParsedStreamEvent;
  if (typeof event.type !== 'string') {
    return null;
  }

  // Allow events without version (backward compat) but reject mismatched versions
  if (event.eventVersion !== undefined && !hasSupportedEventVersion(event)) {
    logger.warn('Skipping stream event with unsupported version', {
      expectedEventVersion: EVENT_SCHEMA_VERSION,
      receivedEventVersion: event.eventVersion,
      eventType: event.type,
      runId: event.runId,
      requestId: event.requestId,
    });
    return null;
  }

  if (!KNOWN_EVENT_TYPES.has(event.type)) {
    logger.info('Ignoring unknown stream event type for forward compatibility', {
      type: event.type,
      runId: event.runId,
      requestId: event.requestId,
      eventVersion: event.eventVersion,
    });
    return null;
  }

  return event;
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface ToolExecution {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface Citation {
  id: string;
  source: string;
  url?: string;
  relevance?: number;
}

export interface MemoryContext {
  id: string;
  memoryId: string;
  content: string;
  relevance: number;
}

export interface GeneratedImage {
  id: string;
  data: string;
  mimeType: string;
  caption?: string;
  model?: string;
}

export interface HandoffInfo {
  from: AgentType;
  to: AgentType;
  reason: string;
  timestamp: Date;
}

export interface WidgetAction {
  widgetId: 'tasks' | 'calendar' | 'finance' | 'home' | 'weather' | 'github';
  action: 'refresh' | 'create' | 'update' | 'delete';
  data?: Record<string, unknown>;
}

export type RunState = 'queued' | 'running' | 'awaiting_tool' | 'completed' | 'failed' | 'cancelled';

export interface RunMetadata {
  runId: string;
  state: RunState;
  startedAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
  isStreaming: boolean;
  toolExecutions: ToolExecution[];
  timestamp: Date;
  citations?: Citation[];
  memoriesUsed?: MemoryContext[];
  images?: GeneratedImage[];
  handoff?: HandoffInfo;
  imageAnalysis?: string;
  run?: RunMetadata;
  isReasoning?: boolean;
  reasoningDurationMs?: number;
}

export type PipelineState = 'routing' | 'thinking' | 'tool_executing' | 'composing' | 'done' | null;

export interface RunInspectorEvent {
  id: string;
  type: string;
  timestamp: Date;
  summary: string;
}

export type ChatConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'degraded' | 'offline';

export interface ChatState {
  messages: StreamingMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  currentAgent: AgentType | null;
  routingReason: string | null;
  routingConfidence: number | null;
  pendingHandoff: HandoffInfo | null;
  error: string | null;
  threadId: string | null;
  runState: RunState | null;
  runId: string | null;
  runStartedAt: Date | null;
  runUpdatedAt: Date | null;
  runEndedAt: Date | null;
  pipelineState: PipelineState;
  pipelineDetail: string | null;
  inspectorEvents: RunInspectorEvent[];
  connectionStatus: ChatConnectionStatus;
  reconnectAttempt: number;
  queuedMessages: number;
  sessionId: string | null;
}

interface UseChatOptions {
  userId: string;
  threadId?: string | null;
  userProfile?: {
    name?: string;
    timezone?: string;
    communicationStyle?: 'concise' | 'detailed';
    location?: {
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
      coordinates?: {
        lat: number;
        long: number;
      };
    };
  };
  /** @deprecated Legacy orchestration toggle is no longer used. */
  useLegacy?: boolean;
  onMessage?: (message: StreamingMessage) => void;
  onToolExecution?: (tool: ToolExecution) => void;
  onRouting?: (agent: AgentType, reason: string, confidence: number) => void;
  onAgentStart?: (agent: AgentType) => void;
  onHandoff?: (handoff: HandoffInfo) => void;
  onCitation?: (citation: Citation) => void;
  onMemoryUsed?: (memory: MemoryContext) => void;
  onImageGenerated?: (image: GeneratedImage) => void;
  onImageAnalyzed?: (analysis: string, imageUrl?: string) => void;
  onTTSChunk?: (text: string, isComplete: boolean) => void;
  onWidgetAction?: (action: WidgetAction) => void;
  onThreadCreated?: (threadId: string) => void;
  onMemoryExtracted?: (count: number) => void;
  onError?: (error: string, recoverable?: boolean) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useChat(options: UseChatOptions) {
  const {
    userId,
    threadId: initialThreadId,
    userProfile,
    onMessage,
    onToolExecution,
    onRouting,
    onAgentStart,
    onHandoff,
    onCitation,
    onMemoryUsed,
    onImageGenerated,
    onImageAnalyzed,
    onTTSChunk,
    onWidgetAction,
    onThreadCreated,
    onMemoryExtracted,
    onError
  } = options;

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    currentAgent: null,
    routingReason: null,
    routingConfidence: null,
    pendingHandoff: null,
    error: null,
    threadId: initialThreadId || null,
    runState: null,
    runId: null,
    runStartedAt: null,
    runUpdatedAt: null,
    runEndedAt: null,
    pipelineState: null,
    pipelineDetail: null,
    inspectorEvents: [],
    connectionStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting',
    reconnectAttempt: 0,
    queuedMessages: 0,
    sessionId: null,
  });

  // Track if we should skip the next message load (when thread is created during streaming)
  const skipNextLoadRef = useRef(false);
  const getRunStoreKey = useCallback((threadId: string) => `q8_run_metadata_${threadId}`, []);

  const saveRunMetadata = useCallback((threadId: string, messageId: string, run: RunMetadata) => {
    if (typeof window === 'undefined') return;
    try {
      const key = getRunStoreKey(threadId);
      const current = localStorage.getItem(key);
      const parsed = current ? JSON.parse(current) as Record<string, unknown> : {};
      parsed[messageId] = {
        ...run,
        startedAt: run.startedAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        endedAt: run.endedAt?.toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (error) {
      logger.warn('Failed to persist run metadata', { threadId, messageId, error });
    }
  }, [getRunStoreKey]);

  // Load existing messages when threadId changes
  useEffect(() => {
    if (initialThreadId) {
      const shouldLoad = !state.isStreaming && !state.isLoading && state.threadId !== initialThreadId;
      setState(prev => ({ ...prev, threadId: initialThreadId }));
      if (shouldLoad && !skipNextLoadRef.current) {
        loadMessages(initialThreadId);
      }
      skipNextLoadRef.current = false;
    } else {
      if (!state.isStreaming && !state.isLoading) {
        setState(prev => ({
          ...prev,
          messages: [],
          threadId: null,
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId]);

  /**
   * Load messages from Supabase
   */
  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}?includeMessages=true`);
      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      let persistedRuns: Record<string, {
        runId: string;
        state: RunState;
        startedAt: string;
        updatedAt: string;
        endedAt?: string;
      }> = {};

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(getRunStoreKey(threadId));
        if (stored) {
          persistedRuns = JSON.parse(stored) as typeof persistedRuns;
        }
      }

      const loadedMessages: StreamingMessage[] = (data.messages || []).map((m: {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        agent_name?: string;
        tool_executions?: ToolExecution[];
        metadata?: Record<string, unknown>;
        created_at: string;
      }) => {
        const persistedRun = persistedRuns[m.id];
        const runMetadata = (persistedRun || (m.metadata?.run as Record<string, unknown> | undefined));
        const run = runMetadata && typeof runMetadata.runId === 'string' && typeof runMetadata.state === 'string'
          ? {
              runId: runMetadata.runId,
              state: runMetadata.state as RunState,
              startedAt: runMetadata.startedAt ? new Date(String(runMetadata.startedAt)) : new Date(m.created_at),
              updatedAt: runMetadata.updatedAt ? new Date(String(runMetadata.updatedAt)) : new Date(m.created_at),
              endedAt: runMetadata.endedAt ? new Date(String(runMetadata.endedAt)) : undefined,
            }
          : undefined;

        return {
          id: m.id,
          role: m.role,
          content: m.content,
          agent: m.agent_name as AgentType | undefined,
          isStreaming: false,
          toolExecutions: m.tool_executions || [],
          timestamp: new Date(m.created_at),
          run,
        };
      });

      const latestRun = [...loadedMessages].reverse().find(message => message.role === 'assistant' && message.run)?.run;

      setState(prev => ({
        ...prev,
        messages: loadedMessages,
        threadId,
        runState: latestRun?.state || null,
        runId: latestRun?.runId || null,
        runStartedAt: latestRun?.startedAt || null,
        runUpdatedAt: latestRun?.updatedAt || null,
        runEndedAt: latestRun?.endedAt || null,
      }));
    } catch (err) {
      logger.error('Failed to load messages', { threadId, error: err });
    }
  }, [getRunStoreKey]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageRef = useRef<StreamingMessage | null>(null);

  // Delta batching: buffer content deltas in a ref, flush to state via RAF
  const contentBufferRef = useRef('');
  const rafIdRef = useRef<number | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);

  const flushContentBuffer = useCallback(() => {
    rafIdRef.current = null;
    const buffered = contentBufferRef.current;
    const msgId = activeMessageIdRef.current;
    if (!buffered || !msgId) return;
    contentBufferRef.current = '';
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === msgId
          ? { ...m, content: m.content + buffered }
          : m
      ),
    }));
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const OUTBOX_KEY = `q8_chat_outbox_${userId}`;
  const MAX_RECONNECT_ATTEMPTS = 6;
  const HEARTBEAT_INTERVAL_MS = 15000;

  const appendInspectorEvent = useCallback((type: string, summary: string) => {
    setState(prev => ({
      ...prev,
      inspectorEvents: [
        ...prev.inspectorEvents,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type,
          timestamp: new Date(),
          summary,
        },
      ].slice(-200),
    }));
  }, []);

  const generateRequestId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  type OutboxMessage = {
    id: string;
    content: string;
    threadId: string | null;
    requestId: string;
    createdAt: string;
    userProfile?: UseChatOptions['userProfile'];
  };

  const readOutbox = useCallback((): OutboxMessage[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      return raw ? (JSON.parse(raw) as OutboxMessage[]) : [];
    } catch {
      return [];
    }
  }, [OUTBOX_KEY]);

  const writeOutbox = useCallback((items: OutboxMessage[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    setState(prev => ({ ...prev, queuedMessages: items.length }));
  }, [OUTBOX_KEY]);

  const enqueueOutbox = useCallback((item: OutboxMessage) => {
    const items = readOutbox();
    items.push(item);
    writeOutbox(items);
    appendInspectorEvent('queue_enqueue', 'Message queued for retry while connection is unavailable');
  }, [readOutbox, writeOutbox, appendInspectorEvent]);

  const dequeueOutbox = useCallback(() => {
    const items = readOutbox();
    const shifted = items.shift();
    writeOutbox(items);
    if (shifted) {
      appendInspectorEvent('queue_dequeue', 'Queued message replayed successfully');
    }
  }, [readOutbox, writeOutbox, appendInspectorEvent]);

  const sendMessage = useCallback(async (
    content: string,
    options?: { requestId?: string; queueOnFailure?: boolean; optimistic?: boolean; threadId?: string | null; userProfile?: UseChatOptions['userProfile'] }
  ) => {
    const requestId = options?.requestId ?? generateRequestId();
    const queueOnFailure = options?.queueOnFailure ?? true;
    const optimistic = options?.optimistic ?? true;
    const effectiveThreadId = options?.threadId ?? state.threadId;
    const effectiveProfile = options?.userProfile ?? userProfile;

    if (!content.trim()) {
      return { sent: false, queued: false };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (queueOnFailure) {
        enqueueOutbox({ id: `out_${Date.now()}`, content, threadId: effectiveThreadId, requestId, createdAt: new Date().toISOString(), userProfile: effectiveProfile });
        setState(prev => ({ ...prev, connectionStatus: 'offline', error: 'Offline: message queued and will send when connected.' }));
      }
      appendInspectorEvent('connection_offline', 'Offline detected; queued outbound message');
      return { sent: false, queued: queueOnFailure };
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (optimistic) {
      const userMessageId = `msg_${Date.now()}_user`;
      const userMessage: StreamingMessage = {
        id: userMessageId,
        role: 'user',
        content,
        isStreaming: false,
        toolExecutions: [],
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        isStreaming: false,
        error: null,
        currentAgent: null,
        routingReason: null,
        runState: 'queued',
        runId: null,
        runStartedAt: new Date(),
        runUpdatedAt: new Date(),
        runEndedAt: null,
      }));
    }

    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const assistantMessage: StreamingMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolExecutions: [],
      timestamp: new Date(),
    };

    streamingMessageRef.current = assistantMessage;
    activeMessageIdRef.current = assistantMessageId;
    contentBufferRef.current = '';

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      isStreaming: true,
      pipelineState: 'routing',
      pipelineDetail: null,
      connectionStatus: 'connected',
    }));

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          threadId: effectiveThreadId,
          requestId,
          userProfile: effectiveProfile,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const raw = JSON.parse(line.slice(6));
            const parsed = parseVersionedEvent(raw);
            if (parsed) {
              await processStreamEvent(parsed, assistantMessageId);
            }
          } catch (e) {
            logger.warn('Failed to parse SSE event', { line, error: e });
          }
        }
      }

      return { sent: true, queued: false };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { sent: false, queued: false };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const shouldQueue = queueOnFailure && !String(errorMessage).includes('HTTP error: 4');

      if (shouldQueue) {
        enqueueOutbox({ id: `out_${Date.now()}`, content, threadId: effectiveThreadId, requestId, createdAt: new Date().toISOString(), userProfile: effectiveProfile });
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        error: shouldQueue ? 'Connection issue: message queued for retry.' : errorMessage,
        connectionStatus: 'reconnecting',
      }));
      appendInspectorEvent('connection_error', shouldQueue ? 'Stream failed; message moved to retry queue' : `Stream failed: ${errorMessage}`);
      onError?.(errorMessage);
      return { sent: false, queued: shouldQueue };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.threadId, userProfile, onError, enqueueOutbox]);

  const flushOutbox = useCallback(async () => {
    if (state.isStreaming) return;
    const items = readOutbox();
    if (!items.length) return;

    appendInspectorEvent('queue_flush_start', `Replaying ${items.length} queued message${items.length > 1 ? 's' : ''}`);

    for (const item of items) {
      const result = await sendMessage(item.content, {
        requestId: item.requestId,
        queueOnFailure: false,
        optimistic: true,
        threadId: item.threadId,
        userProfile: item.userProfile,
      });

      if (!result.sent) {
        appendInspectorEvent('queue_flush_pause', 'Replay paused due to connectivity issue');
        break;
      }
      dequeueOutbox();
    }
  }, [state.isStreaming, readOutbox, sendMessage, dequeueOutbox, appendInspectorEvent]);

  useEffect(() => {
    const updateOnlineState = () => {
      const online = navigator.onLine;
      setState(prev => ({
        ...prev,
        connectionStatus: online ? 'reconnecting' : 'offline',
      }));
      appendInspectorEvent(online ? 'connection_online' : 'connection_offline', online ? 'Network restored; reconnecting session' : 'Network lost; switching to offline queue mode');
      if (online) {
        void flushOutbox();
      }
    };

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, [flushOutbox, appendInspectorEvent]);

  useEffect(() => {
    const queue = readOutbox();
    setState(prev => ({ ...prev, queuedMessages: queue.length }));
  }, [readOutbox]);

  useEffect(() => {
    let active = true;
    let reconnectAttempt = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
      if (!active) return;
      if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        setState(prev => ({ ...prev, connectionStatus: 'degraded', reconnectAttempt }));
        appendInspectorEvent('connection_degraded', 'Max reconnect attempts reached; staying in degraded mode');
        return;
      }
      const delay = Math.min(2000 * (2 ** Math.max(reconnectAttempt - 1, 0)), 30000);
      reconnectTimeout = setTimeout(() => {
        void establishSession();
      }, delay);
    };

    const establishSession = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setState(prev => ({ ...prev, connectionStatus: 'offline' }));
        return;
      }

      try {
        setState(prev => ({ ...prev, connectionStatus: reconnectAttempt === 0 ? 'connecting' : 'reconnecting', reconnectAttempt }));
        const res = await fetch('/api/chat/session', { method: 'POST' });
        if (!res.ok) throw new Error(`Session error ${res.status}`);
        const data = await res.json() as { sessionId: string };
        if (!active) return;

        const recovered = reconnectAttempt > 0;
        reconnectAttempt = 0;

        setState(prev => ({ ...prev, sessionId: data.sessionId, connectionStatus: 'connected', reconnectAttempt: 0 }));
        if (recovered) {
          appendInspectorEvent('connection_resumed', 'Session restored and reconnected');
        }
        void flushOutbox();
      } catch {
        reconnectAttempt += 1;
        if (!active) return;
        setState(prev => ({
          ...prev,
          connectionStatus: reconnectAttempt > 3 ? 'degraded' : 'reconnecting',
          reconnectAttempt,
        }));
        appendInspectorEvent('connection_retry', `Session reconnect attempt ${reconnectAttempt} failed`);
        scheduleReconnect();
      }
    };

    void establishSession();

    const heartbeatId = setInterval(async () => {
      if (!active) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setState(prev => ({ ...prev, connectionStatus: 'offline' }));
        return;
      }

      try {
        const sessionId = state.sessionId;
        const url = sessionId ? `/api/chat/session?sessionId=${encodeURIComponent(sessionId)}` : '/api/chat/session';
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error('heartbeat_failed');
        setState(prev => ({ ...prev, connectionStatus: 'connected', reconnectAttempt: 0 }));
      } catch {
        reconnectAttempt += 1;
        setState(prev => ({
          ...prev,
          connectionStatus: reconnectAttempt > 3 ? 'degraded' : 'reconnecting',
          reconnectAttempt,
        }));
        appendInspectorEvent('heartbeat_missed', `Heartbeat missed (attempt ${reconnectAttempt})`);
        scheduleReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(heartbeatId);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushOutbox, state.sessionId, appendInspectorEvent]);

  /**
   * Process a stream event
   */
  const processStreamEvent = useCallback(async (
    event: ParsedStreamEvent,
    messageId: string
  ) => {
    const updateRunMetadata = (newState: RunState, runId?: string) => {
      const now = new Date();
      const isTerminal = newState === 'completed' || newState === 'failed' || newState === 'cancelled';
      setState(prev => {
        const updatedRunId = runId || prev.runId;
        const run: RunMetadata = {
          runId: updatedRunId || '',
          state: newState,
          startedAt: prev.runStartedAt || now,
          updatedAt: now,
          endedAt: isTerminal ? now : prev.runEndedAt ?? undefined,
        };

        const threadId = prev.threadId;
        if (threadId) {
          saveRunMetadata(threadId, messageId, run);
        }

        return {
          ...prev,
          runState: newState,
          runId: updatedRunId,
          runUpdatedAt: now,
          runEndedAt: isTerminal ? now : prev.runEndedAt,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, run } : m
          ),
        };
      });
    };

    switch (event.type) {
      case 'run_created':
        if (event.runId) {
          updateRunMetadata('queued', event.runId as string);
          appendInspectorEvent('run_created', `Run queued (${event.runId})`);
        }
        break;

      case 'run_state':
        if (event.state) {
          updateRunMetadata(event.state as RunState, event.runId as string);
          const pipeState = event.state as PipelineState;
          setState(prev => ({
            ...prev,
            pipelineState: pipeState,
            pipelineDetail: (event.detail as string) || null,
          }));
          appendInspectorEvent('run_state', `Run is now ${String(event.state).replace('_', ' ')}`);
        }
        break;

      case 'thread_created':
        if (event.threadId) {
          skipNextLoadRef.current = true;
          setState(prev => ({ ...prev, threadId: event.threadId! }));
          onThreadCreated?.(event.threadId);
        }
        break;

      case 'memory_extracted':
        if (event.count !== undefined) {
          onMemoryExtracted?.(event.count);
        }
        break;

      case 'routing':
        setState(prev => ({
          ...prev,
          currentAgent: event.agent || null,
          routingReason: event.reason || null,
          routingConfidence: event.confidence ?? null,
          pendingHandoff: null,
        }));
        if (event.agent && event.reason) {
          onRouting?.(event.agent, event.reason, event.confidence ?? 0);
          appendInspectorEvent('routing', `${event.agent} selected — ${event.reason}`);
        }
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, agent: event.agent } : m
          ),
        }));
        break;

      case 'agent_start':
        if (event.agent) {
          setState(prev => ({
            ...prev,
            currentAgent: event.agent || null,
            pendingHandoff: null,
          }));
          onAgentStart?.(event.agent);
          appendInspectorEvent('agent_start', `${event.agent} started execution`);
        }
        break;

      case 'handoff':
        if (event.from && event.to && event.reason) {
          const handoff: HandoffInfo = {
            from: event.from,
            to: event.to,
            reason: event.reason,
            timestamp: new Date(),
          };
          setState(prev => ({
            ...prev,
            pendingHandoff: handoff,
            messages: prev.messages.map(m =>
              m.id === messageId ? { ...m, handoff } : m
            ),
          }));
          onHandoff?.(handoff);
          appendInspectorEvent('handoff', `${event.from} → ${event.to} (${event.reason})`);
        }
        break;

      case 'tool_start':
        if (event.tool) {
          const toolExecution: ToolExecution = {
            id: event.id || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            tool: event.tool,
            args: event.args || {},
            status: 'running',
            startTime: new Date(),
          };

          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? { ...m, toolExecutions: [...m.toolExecutions, toolExecution] }
                : m
            ),
          }));
          onToolExecution?.(toolExecution);
          appendInspectorEvent('tool_start', `${event.tool} started`);
        }
        break;

      case 'tool_end':
        if (event.tool) {
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? {
                    ...m,
                    toolExecutions: m.toolExecutions.map(t => {
                      const isMatch = event.id
                        ? t.id === event.id
                        : t.tool === event.tool && t.status === 'running';

                      return isMatch
                        ? {
                            ...t,
                            status: event.success ? 'completed' : 'failed',
                            result: event.result,
                            endTime: new Date(),
                            duration: event.duration,
                          }
                        : t;
                    }),
                  }
                : m
            ),
          }));
          appendInspectorEvent('tool_end', `${event.tool} ${event.success ? 'completed' : 'failed'}`);
        }
        break;

      case 'citation':
        if (event.source) {
          const citation: Citation = {
            id: `citation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            source: event.source,
            url: event.url,
            relevance: event.relevance,
          };
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? { ...m, citations: [...(m.citations || []), citation] }
                : m
            ),
          }));
          onCitation?.(citation);
        }
        break;

      case 'memory_used':
        if (event.memoryId && event.content !== undefined) {
          const memory: MemoryContext = {
            id: `memory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            memoryId: event.memoryId,
            content: event.content,
            relevance: event.relevance ?? 0,
          };
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? { ...m, memoriesUsed: [...(m.memoriesUsed || []), memory] }
                : m
            ),
          }));
          onMemoryUsed?.(memory);
        }
        break;

      case 'image_generated':
        if (event.imageData && event.mimeType) {
          const image: GeneratedImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            data: event.imageData,
            mimeType: event.mimeType,
            caption: event.caption,
            model: event.model,
          };
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? { ...m, images: [...(m.images || []), image] }
                : m
            ),
          }));
          onImageGenerated?.(image);
        }
        break;

      case 'image_analyzed':
        if (event.analysis) {
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? { ...m, imageAnalysis: event.analysis }
                : m
            ),
          }));
          onImageAnalyzed?.(event.analysis, event.imageUrl);
        }
        break;

      case 'tts_chunk':
        if (event.text !== undefined) {
          onTTSChunk?.(event.text, event.isComplete ?? false);
        }
        break;

      case 'widget_action':
        if (event.widgetId && event.action) {
          const widgetAction: WidgetAction = {
            widgetId: event.widgetId as WidgetAction['widgetId'],
            action: event.action as WidgetAction['action'],
            data: event.data,
          };
          onWidgetAction?.(widgetAction);
        }
        break;

      case 'content':
        if (event.delta) {
          // Batch deltas in ref, flush via RAF for ~60fps renders instead of per-token
          contentBufferRef.current += event.delta;
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(flushContentBuffer);
          }
        }
        break;

      case 'done':
        // Flush any remaining buffered content before finalizing
        if (contentBufferRef.current && activeMessageIdRef.current === messageId) {
          const remaining = contentBufferRef.current;
          contentBufferRef.current = '';
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId ? { ...m, content: m.content + remaining } : m
            ),
          }));
        }
        activeMessageIdRef.current = null;

        updateRunMetadata('completed', event.runId as string);
        appendInspectorEvent('done', `Run completed with ${event.agent || 'orchestrator'}`);
        // Handle images from done event
        const doneImages = event.images?.map(img => ({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          data: img.data,
          mimeType: img.mimeType,
          caption: img.caption,
        }));

        setState(prev => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          pendingHandoff: null,
          pipelineState: 'done',
          pipelineDetail: null,
          messages: prev.messages.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  content: event.fullContent || m.content,
                  agent: event.agent || m.agent,
                  isStreaming: false,
                  images: doneImages?.length ? [...(m.images || []), ...doneImages] : m.images,
                }
              : m
          ),
        }));

        const finalMessage = state.messages.find(m => m.id === messageId);
        if (finalMessage) {
          onMessage?.({ ...finalMessage, content: event.fullContent || finalMessage.content, isStreaming: false });
        }
        break;

      case 'reasoning_start':
        setState(prev => ({
          ...prev,
          pipelineState: 'thinking',
          pipelineDetail: 'Deep reasoning...',
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, isReasoning: true } : m
          ),
        }));
        appendInspectorEvent('reasoning_start', 'Deep reasoning started');
        break;

      case 'reasoning_end':
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId
              ? { ...m, isReasoning: false, reasoningDurationMs: (event as ParsedStreamEvent).durationMs as number | undefined }
              : m
          ),
        }));
        appendInspectorEvent('reasoning_end', 'Reasoning finished');
        break;

      case 'guardrail_triggered':
        // Guardrail blocks are followed by an error event, so just log
        logger.warn('Guardrail triggered', {
          guardrail: (event as ParsedStreamEvent).guardrail,
          message: event.message,
        });
        break;

      case 'interruption_required':
      case 'interruption_resolved':
        // Forward-compatible: log for now, confirmation UI in future
        logger.info('HITL event received', { type: event.type });
        break;

      case 'error':
        updateRunMetadata('failed', event.runId as string);
        appendInspectorEvent('error', event.message || 'Unknown error');
        activeMessageIdRef.current = null;
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          error: event.message || 'Unknown error',
          pipelineState: null,
          pipelineDetail: null,
          messages: prev.messages.map(m =>
            m.id === messageId
              ? { ...m, isStreaming: false, content: m.content || 'Error occurred' }
              : m
          ),
        }));
        if (event.message && typeof event.message === 'string') {
          onError?.(event.message, event.recoverable as boolean | undefined);
        }
        break;

      default:
        logger.info('Unhandled stream event (ignored for forward compatibility)', {
          eventType: event.type,
          runId: event.runId,
          requestId: event.requestId,
          eventVersion: event.eventVersion,
        });
        break;
    }
  }, [
    onRouting,
    onAgentStart,
    onHandoff,
    onToolExecution,
    onCitation,
    onMemoryUsed,
    onImageGenerated,
    onImageAnalyzed,
    onTTSChunk,
    onWidgetAction,
    onMessage,
    onError,
    onThreadCreated,
    onMemoryExtracted,
    state.messages,
    saveRunMetadata,
    flushContentBuffer,
    appendInspectorEvent,
  ]);

  /**
   * Cancel the current stream
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      activeMessageIdRef.current = null;
      contentBufferRef.current = '';
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        pipelineState: null,
        pipelineDetail: null,
        runState: 'cancelled',
        runUpdatedAt: new Date(),
        runEndedAt: new Date(),
        messages: prev.messages.map(m =>
          m.isStreaming && m.run
            ? { ...m, run: { ...m.run, state: 'cancelled' as RunState, updatedAt: new Date(), endedAt: new Date() } }
            : m
        ),
      }));
    }
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      isLoading: false,
      isStreaming: false,
      currentAgent: null,
      routingReason: null,
      error: null,
      threadId: null,
      runState: null,
      runId: null,
      runStartedAt: null,
      runUpdatedAt: null,
      runEndedAt: null,
      pipelineState: null,
      pipelineDetail: null,
      inspectorEvents: [],
      queuedMessages: 0,
    }));
  }, []);

  /**
   * Retry the last message
   */
  const retryLast = useCallback(() => {
    const lastUserMessage = [...state.messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(m => 
          m.role === 'user' || 
          m.timestamp < lastUserMessage.timestamp
        ),
      }));
      sendMessage(lastUserMessage.content);
    }
  }, [state.messages, sendMessage]);

  return {
    ...state,
    sendMessage,
    cancelStream,
    clearMessages,
    retryLast,
  };
}

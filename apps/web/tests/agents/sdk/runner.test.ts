/**
 * Tests for Agent Runner (SDK-based)
 * Tests the streamMessage function and event mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// HOISTED MOCK STATE
// =============================================================================

const { mockRun, mockRoute, mockToOrch, mockGetAgent, mockGetAgentType, mockClassifyError } = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockRoute = vi.fn();
  const mockToOrch = vi.fn();
  const mockGetAgent = vi.fn();
  const mockGetAgentType = vi.fn();
  const mockClassifyError = vi.fn();
  return { mockRun, mockRoute, mockToOrch, mockGetAgent, mockGetAgentType, mockClassifyError };
});

// =============================================================================
// MOCK SETUP
// =============================================================================

vi.mock('@openai/agents', () => ({
  run: mockRun,
  Agent: vi.fn(),
  handoff: vi.fn(),
}));

vi.mock('@/lib/agents/sdk/router', () => ({
  route: mockRoute,
  toOrchestrationRoutingDecision: mockToOrch,
}));

vi.mock('@/lib/agents/sdk/agents', () => {
  const makeAgent = (name: string) => {
    const obj: Record<string, unknown> = { name, instructions: `Instructions for ${name}` };
    obj.clone = vi.fn().mockImplementation((overrides: Record<string, unknown>) => ({
      ...obj,
      ...overrides,
    }));
    return obj;
  };
  return {
    orchestratorAgent: makeAgent('Q8'),
    getAgent: mockGetAgent,
    getAgentType: mockGetAgentType,
    AgentTypeSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
  };
});

vi.mock('@/lib/agents/sdk/utils/errors', () => ({
  classifyError: mockClassifyError,
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/agents/sdk/model-provider', () => ({
  getAgentModel: vi.fn(() => 'gpt-4.1'),
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { streamMessage } from '@/lib/agents/sdk/runner';
import type { StreamMessageOptions, RunContext } from '@/lib/agents/sdk/runner';

// =============================================================================
// HELPERS
// =============================================================================

function createMockStream(events: Array<Record<string, unknown>> = []) {
  let index = 0;
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (index < events.length) {
          return Promise.resolve({ done: false, value: events[index++] });
        }
        return Promise.resolve({ done: true, value: undefined });
      },
    }),
    completed: Promise.resolve(),
    lastAgent: null as { name: string } | null,
  };
}

function makeAgent(name: string) {
  const obj: Record<string, unknown> = { name, instructions: `Instructions for ${name}` };
  obj.clone = vi.fn().mockImplementation((overrides: Record<string, unknown>) => ({
    ...obj,
    ...overrides,
  }));
  return obj;
}

// =============================================================================
// TESTS
// =============================================================================

describe('Agent Runner (SDK)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behaviors (clearAllMocks removes these)
    mockRoute.mockResolvedValue({
      agent: 'personality',
      confidence: 0.9,
      rationale: 'Casual conversation',
      source: 'keyword',
    });

    mockToOrch.mockImplementation((d: Record<string, unknown>) => ({
      agent: d.agent,
      confidence: d.confidence,
      rationale: d.rationale,
      source: 'heuristic',
    }));

    mockGetAgent.mockImplementation((type: string) => makeAgent(type));
    mockGetAgentType.mockReturnValue('personality');
    mockClassifyError.mockReturnValue({ code: 'UNKNOWN', recoverable: false, message: 'Unknown error' });
    mockRun.mockResolvedValue(createMockStream());
  });

  describe('streamMessage', () => {
    it('exports streamMessage as an async generator function', () => {
      expect(typeof streamMessage).toBe('function');
    });

    it('yields thread_created event when no threadId provided', async () => {
      const events: Array<{ type: string }> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'user-1' })) {
        events.push(event);
      }
      expect(events[0]).toEqual(expect.objectContaining({ type: 'thread_created' }));
    });

    it('does not yield thread_created when threadId is provided', async () => {
      const events: Array<{ type: string }> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'user-1', threadId: 'existing-thread' })) {
        events.push(event);
      }
      const threadCreated = events.find(e => e.type === 'thread_created');
      expect(threadCreated).toBeUndefined();
    });

    it('yields routing event', async () => {
      const events: Array<{ type: string }> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'user-1', threadId: 't' })) {
        events.push(event);
      }
      expect(events.find(e => e.type === 'routing')).toBeDefined();
    });

    it('yields agent_start event', async () => {
      const events: Array<{ type: string }> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'user-1', threadId: 't' })) {
        events.push(event);
      }
      expect(events.find(e => e.type === 'agent_start')).toBeDefined();
    });

    it('yields done event at the end', async () => {
      const events: Array<{ type: string }> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'user-1', threadId: 't' })) {
        events.push(event);
      }
      expect(events[events.length - 1]?.type).toBe('done');
    });

    it('uses forceAgent when provided (skips routing)', async () => {
      const events: Array<Record<string, unknown>> = [];
      for await (const event of streamMessage({
        message: 'Code review please',
        userId: 'user-1',
        threadId: 't',
        forceAgent: 'coder',
      })) {
        events.push(event);
      }
      expect(mockRoute).not.toHaveBeenCalled();
      const agentStart = events.find(e => e.type === 'agent_start');
      expect(agentStart).toEqual(expect.objectContaining({ agent: 'coder' }));
    });

    it('calls SDK run() with correct arguments', async () => {
      for await (const _e of streamMessage({ message: 'Test msg', userId: 'u', threadId: 't', maxTurns: 5 })) { /* drain */ }

      expect(mockRun).toHaveBeenCalledWith(
        expect.anything(),
        'Test msg',
        expect.objectContaining({ stream: true, maxTurns: 5, signal: undefined })
      );
    });

    it('forwards external abort signal when provided', async () => {
      const controller = new AbortController();

      for await (const _e of streamMessage({
        message: 'Test msg',
        userId: 'u',
        threadId: 't',
        signal: controller.signal,
      })) { /* drain */ }

      expect(mockRun).toHaveBeenCalledWith(
        expect.anything(),
        'Test msg',
        expect.objectContaining({ signal: controller.signal })
      );
    });

    it('uses default maxTurns of 10', async () => {
      for await (const _e of streamMessage({ message: 'Test', userId: 'u', threadId: 't' })) { /* drain */ }

      expect(mockRun).toHaveBeenCalledWith(
        expect.anything(),
        'Test',
        expect.objectContaining({ maxTurns: 10 })
      );
    });

    it('yields error event when run() throws', async () => {
      mockRun.mockRejectedValueOnce(new Error('API key invalid'));

      const events: Array<Record<string, unknown>> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'u', threadId: 't' })) {
        events.push(event);
      }

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.message).toBe('API key invalid');
    });

    it('processes raw_model_stream_event with output_text_delta', async () => {
      mockRun.mockResolvedValueOnce(createMockStream([
        { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta: 'Hello ' } },
        { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta: 'world!' } },
      ]));

      const events: Array<Record<string, unknown>> = [];
      for await (const event of streamMessage({ message: 'Hello', userId: 'u', threadId: 't' })) {
        events.push(event);
      }

      const contentEvents = events.filter(e => e.type === 'content');
      expect(contentEvents).toHaveLength(2);
      expect(contentEvents[0]?.delta).toBe('Hello ');
      expect(contentEvents[1]?.delta).toBe('world!');

      const doneEvent = events.find(e => e.type === 'done') as Record<string, unknown>;
      expect(doneEvent?.fullContent).toBe('Hello world!');
    });

    it('processes agent_updated_stream_event as handoff', async () => {
      mockRun.mockResolvedValueOnce(createMockStream([
        { type: 'agent_updated_stream_event', agent: { name: 'DevBot' } },
      ]));

      const events: Array<Record<string, unknown>> = [];
      for await (const event of streamMessage({ message: 'Help', userId: 'u', threadId: 't' })) {
        events.push(event);
      }

      const handoffEvent = events.find(e => e.type === 'handoff');
      expect(handoffEvent).toBeDefined();
      expect(handoffEvent?.to).toBeDefined();
    });

    it('skips tool events when showToolExecutions is false', async () => {
      mockRun.mockResolvedValueOnce(createMockStream([
        {
          type: 'run_item_stream_event',
          name: 'tool_called',
          item: { rawItem: { type: 'function_call', callId: 'c1', name: 'calc', arguments: '{}' } },
        },
      ]));

      const events: Array<Record<string, unknown>> = [];
      for await (const event of streamMessage({
        message: 'Calculate', userId: 'u', threadId: 't', showToolExecutions: false,
      })) {
        events.push(event);
      }

      const toolEvents = events.filter(e => e.type === 'tool_start' || e.type === 'tool_end');
      expect(toolEvents).toHaveLength(0);
    });
  });

  describe('StreamMessageOptions type', () => {
    it('accepts all expected options', () => {
      const options: StreamMessageOptions = {
        message: 'Test message',
        userId: 'test-user',
        threadId: 'test-thread',
        forceAgent: 'personality',
        showToolExecutions: true,
        maxTurns: 5,
        conversationHistory: [{ role: 'user', content: 'Previous' }],
        userProfile: { name: 'Test User', timezone: 'UTC', communicationStyle: 'concise' },
      };
      expect(options.message).toBe('Test message');
      expect(options.maxTurns).toBe(5);
    });
  });

  describe('RunContext type', () => {
    it('defines expected shape', () => {
      const context: RunContext = {
        userId: 'user-1',
        threadId: 'thread-1',
        userProfile: { name: 'Alice', timezone: 'America/New_York', communicationStyle: 'detailed' },
      };
      expect(context.userId).toBe('user-1');
      expect(context.userProfile?.name).toBe('Alice');
    });
  });

  describe('Module exports', () => {
    it('exports streamMessage function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(typeof runner.streamMessage).toBe('function');
    });

    it('does not export removed legacy functions', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(runner).not.toHaveProperty('runAgent');
      expect(runner).not.toHaveProperty('executeTool');
      expect(runner).not.toHaveProperty('toOpenAITools');
      expect(runner).not.toHaveProperty('buildSystemPrompt');
    });
  });
});

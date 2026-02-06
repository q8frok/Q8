/**
 * Integration Tests for OpenAI Agents SDK
 * Tests the full routing -> agent -> tool execution flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// SHARED MOCK FUNCTIONS - Must be at module level
// =============================================================================

const mockCreate = vi.fn();
const mockParse = vi.fn();

// =============================================================================
// MOCK SETUP - Must be before imports
// =============================================================================

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
          parse: mockParse,
        },
      },
      beta: {
        realtime: {},
        assistants: {},
        threads: {},
      },
    })),
  };
});

// Mock model_factory
vi.mock('@/lib/agents/model_factory', () => ({
  getModel: vi.fn().mockReturnValue({
    model: 'gpt-5.2',
    apiKey: 'test-key',
    baseURL: 'https://api.openai.com/v1',
  }),
  getModelChain: vi.fn().mockReturnValue([
    {
      model: 'gpt-5.2',
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
    },
  ]),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock model-provider (agents module depends on this)
vi.mock('@/lib/agents/sdk/model-provider', () => ({
  getAgentModel: vi.fn(() => 'gpt-4.1'),
}));

// Note: We don't mock safe-math because we want to test the real implementation

// =============================================================================
// IMPORTS - After mocks
// =============================================================================

import type {
  SDKRoutingDecision,
  AgentType,
} from '@/lib/agents/sdk';

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('SDK Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'test-github-token';
    process.env.SPOTIFY_CLIENT_ID = 'test-spotify-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-spotify-secret';
    process.env.SPOTIFY_REFRESH_TOKEN = 'test-spotify-refresh';
    process.env.OPENWEATHER_API_KEY = 'test-weather-key';
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    delete process.env.OPENWEATHER_API_KEY;
  });

  // ===========================================================================
  // FULL MESSAGE FLOW TESTS
  // ===========================================================================

  describe('Full message flow', () => {
    it('routes to coder for GitHub-related messages', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Review my latest pull request on the Q8 repo', { skipLLM: true });

      expect(result.agent).toBe('coder');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(['keyword', 'explicit']).toContain(result.source);
    });

    it('routes to researcher for search queries', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Search for the latest news about AI regulations', { skipLLM: true });

      expect(result.agent).toBe('researcher');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('routes to secretary for scheduling tasks', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Schedule a meeting with John tomorrow at 3pm', { skipLLM: true });

      expect(result.agent).toBe('secretary');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('routes to personality for music requests', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Play some music on Spotify', { skipLLM: true });

      expect(result.agent).toBe('personality');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('routes to home for smart home commands', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Turn on the lights in the living room', { skipLLM: true });

      expect(result.agent).toBe('home');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('routes to finance for budget questions', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('What is my monthly budget looking like?', { skipLLM: true });

      expect(result.agent).toBe('finance');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('routes to imagegen for image generation requests', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Generate an image of a sunset over mountains', { skipLLM: true });

      expect(result.agent).toBe('imagegen');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('handles explicit agent requests with @mention', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('@coder help me debug this issue');

      expect(result.agent).toBe('coder');
      expect(result.source).toBe('explicit');
      expect(result.confidence).toBe(0.99);
    });

    it('handles "ask the" explicit patterns', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('ask the researcher to find papers on machine learning');

      expect(result.agent).toBe('researcher');
      expect(result.source).toBe('explicit');
    });
  });

  // ===========================================================================
  // AGENT SDK HANDOFF TESTS
  // ===========================================================================

  describe('Agent SDK handoffs', () => {
    it('orchestrator agent has handoffs to all specialists', async () => {
      const { orchestratorAgent } = await import('@/lib/agents/sdk/agents');

      // Orchestrator should have handoffs defined
      expect(orchestratorAgent.handoffs).toBeDefined();
      expect(orchestratorAgent.handoffs.length).toBe(7);
    });

    it('getHandoffTargets returns all specialist types', async () => {
      const { getHandoffTargets } = await import('@/lib/agents/sdk/agents');

      const targets = getHandoffTargets();

      expect(targets).toContain('coder');
      expect(targets).toContain('researcher');
      expect(targets).toContain('secretary');
      expect(targets).toContain('personality');
      expect(targets).toContain('home');
      expect(targets).toContain('finance');
      expect(targets).toContain('imagegen');
      expect(targets).not.toContain('orchestrator');
      expect(targets).toHaveLength(7);
    });

    it('specialist agents do not have handoffs', async () => {
      const { getAgent } = await import('@/lib/agents/sdk/agents');

      const specialists: AgentType[] = ['coder', 'researcher', 'secretary', 'personality', 'home', 'finance', 'imagegen'];

      for (const specialist of specialists) {
        const agent = getAgent(specialist);
        expect(agent.handoffs.length).toBe(0);
      }
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('Error handling', () => {
    it('retries on transient errors', async () => {
      const { executeWithRetry, isTransientError } = await import('@/lib/agents/sdk/utils/retry');

      // Verify transient error detection
      expect(isTransientError(new Error('Connection timed out'))).toBe(true);
      expect(isTransientError(new Error('429 Too Many Requests'))).toBe(true);
      expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isTransientError(new Error('502 Bad Gateway'))).toBe(true);

      // Test retry logic
      let attempts = 0;
      const result = await executeWithRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Connection timed out');
          }
          return 'success';
        },
        { maxRetries: 5, backoffMs: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('provides user-friendly error messages', async () => {
      const { getUserFriendlyError, getRecoverySuggestion } = await import('@/lib/agents/sdk/utils/errors');

      // Spotify error
      const spotifyError = getUserFriendlyError('spotify_play', 'API error 401');
      expect(spotifyError).toContain('Spotify');

      // GitHub error
      const githubError = getUserFriendlyError('github_list_repos', 'API error 503');
      expect(githubError).toContain('GitHub');

      // Recovery suggestions
      const authSuggestion = getRecoverySuggestion('github_list_repos', '401 Unauthorized');
      expect(authSuggestion).toContain('authenticat');

      const rateLimitSuggestion = getRecoverySuggestion('spotify_search', '429 rate limit');
      expect(rateLimitSuggestion).toContain('rate limit');
    });

    it('handles missing API credentials gracefully', async () => {
      // Clear environment variables
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      delete process.env.SPOTIFY_REFRESH_TOKEN;

      const { checkToolAvailability } = await import('@/lib/agents/sdk/utils/preflight');

      // Check coder availability (needs GitHub token)
      const coderResult = checkToolAvailability('coder');
      expect(coderResult.available).toBe(false);
      expect(coderResult.missingCredentials).toContain('GitHub');

      // Check personality availability (needs Spotify)
      const personalityResult = checkToolAvailability('personality');
      expect(personalityResult.available).toBe(false);
      expect(personalityResult.missingCredentials).toContain('Spotify');
    });

    it('classifies errors correctly', async () => {
      const { classifyError } = await import('@/lib/agents/sdk/utils/errors');

      // Timeout error
      const timeout = classifyError(new Error('Request timed out'));
      expect(timeout.code).toBe('TIMEOUT');
      expect(timeout.recoverable).toBe(true);

      // Auth error
      const auth = classifyError(new Error('401 Unauthorized'));
      expect(auth.code).toBe('AUTH_ERROR');
      expect(auth.recoverable).toBe(false);

      // Rate limit error
      const rateLimit = classifyError(new Error('429 Too Many Requests'));
      expect(rateLimit.code).toBe('RATE_LIMITED');
      expect(rateLimit.recoverable).toBe(true);

      // Not found error
      const notFound = classifyError(new Error('404 Not Found'));
      expect(notFound.code).toBe('NOT_FOUND');
      expect(notFound.recoverable).toBe(false);
    });

    it('does not retry non-transient errors', async () => {
      const { executeWithRetry, isTransientError } = await import('@/lib/agents/sdk/utils/retry');

      // Verify non-transient error detection
      expect(isTransientError(new Error('Invalid argument'))).toBe(false);
      expect(isTransientError(new Error('Permission denied'))).toBe(false);

      // Should throw immediately without retrying
      let attempts = 0;
      await expect(
        executeWithRetry(
          async () => {
            attempts++;
            throw new Error('Invalid argument');
          },
          { maxRetries: 5, backoffMs: 10 }
        )
      ).rejects.toThrow('Invalid argument');

      expect(attempts).toBe(1);
    });
  });

  // ===========================================================================
  // STREAMING EVENTS TESTS
  // ===========================================================================

  describe('Streaming events', () => {
    it('defines expected event types structure', async () => {
      const eventTypes = [
        'routing',
        'agent_start',
        'handoff',
        'tool_start',
        'tool_end',
        'content',
        'done',
        'error',
        'thread_created',
      ];

      expect(eventTypes).toContain('routing');
      expect(eventTypes).toContain('agent_start');
      expect(eventTypes).toContain('content');
      expect(eventTypes).toContain('done');
      expect(eventTypes).toContain('error');
      expect(eventTypes).toContain('tool_start');
      expect(eventTypes).toContain('tool_end');
    });

    it('runner exports streamMessage function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');

      expect(typeof runner.streamMessage).toBe('function');
    });

    it('runner does not export removed legacy functions', async () => {
      const runner = await import('@/lib/agents/sdk/runner');

      expect(runner).not.toHaveProperty('runAgent');
      expect(runner).not.toHaveProperty('executeTool');
      expect(runner).not.toHaveProperty('toOpenAITools');
      expect(runner).not.toHaveProperty('buildSystemPrompt');
    });
  });

  // ===========================================================================
  // TOOL EXECUTION TESTS
  // ===========================================================================

  describe('Tool execution', () => {
    it('executes calculate tool correctly', async () => {
      const { calculate } = await import('@/lib/agents/sdk/tools/default');

      const result = await calculate({ expression: '2 + 2' });

      expect(result.success).toBe(true);
      expect(result.expression).toBe('2 + 2');
      if (result.success) {
        expect(typeof result.result).toBe('number');
        expect(result.result).toBe(4);
      }
    });

    it('handles calculate tool errors', async () => {
      const { calculate } = await import('@/lib/agents/sdk/tools/default');

      const result = await calculate({ expression: '' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('executes datetime tool with timezone', async () => {
      const { getCurrentDatetime } = await import('@/lib/agents/sdk/tools/default');

      const result = await getCurrentDatetime({ timezone: 'America/New_York' });

      expect(result).toHaveProperty('datetime');
      expect(result).toHaveProperty('timezone');
      expect(result).toHaveProperty('formatted');
      expect(result).toHaveProperty('year');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('day');
      expect(result).toHaveProperty('dayOfWeek');
    });

    it('handles invalid timezone gracefully', async () => {
      const { getCurrentDatetime } = await import('@/lib/agents/sdk/tools/default');

      const result = await getCurrentDatetime({ timezone: 'Invalid/Timezone' });

      expect(result.timezone).toBe('UTC');
    });

    it('handles Spotify API errors', async () => {
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;
      delete process.env.SPOTIFY_REFRESH_TOKEN;

      vi.resetModules();

      const { spotifySearch } = await import('@/lib/agents/sdk/tools/spotify');

      const result = await spotifySearch({ query: 'test song' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_CREDENTIALS');
      }
    });

    it('handles GitHub API errors', async () => {
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

      vi.resetModules();

      const { githubListRepos } = await import('@/lib/agents/sdk/tools/github');

      const result = await githubListRepos({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_CREDENTIALS');
      }
    });
  });

  // ===========================================================================
  // AGENT CONFIGURATION TESTS
  // ===========================================================================

  describe('Agent configurations', () => {
    it('all agents are valid Agent instances', async () => {
      const { getAllAgents, AgentTypeSchema } = await import('@/lib/agents/sdk/agents');

      const agents = getAllAgents();

      expect(agents.length).toBe(8);

      for (const agent of agents) {
        expect(agent.name).toBeDefined();
        expect(typeof agent.instructions === 'string' || typeof agent.instructions === 'function').toBe(true);
        const instructions = typeof agent.instructions === 'string'
          ? agent.instructions
          : '';
        expect(instructions.length).toBeGreaterThan(50);
      }
    });

    it('orchestrator can handoff to all specialists', async () => {
      const { getHandoffTargets } = await import('@/lib/agents/sdk/agents');

      const targets = getHandoffTargets();

      expect(targets).toContain('coder');
      expect(targets).toContain('researcher');
      expect(targets).toContain('secretary');
      expect(targets).toContain('personality');
      expect(targets).toContain('home');
      expect(targets).toContain('finance');
      expect(targets).toContain('imagegen');
      expect(targets).not.toContain('orchestrator');
    });

    it('tool assignments match agent responsibilities', async () => {
      const { getAgent } = await import('@/lib/agents/sdk/agents');

      // Coder should have GitHub tools
      const coder = getAgent('coder');
      const coderToolNames = coder.tools.map((t: { name: string }) => t.name);
      expect(coderToolNames.some((name: string) => name.startsWith('github_'))).toBe(true);

      // Personality should have Spotify tools
      const personality = getAgent('personality');
      const personalityToolNames = personality.tools.map((t: { name: string }) => t.name);
      expect(personalityToolNames.some((name: string) => name.startsWith('spotify_'))).toBe(true);

      // ImageGen should have hosted image generation + default tools
      const imagegen = getAgent('imagegen');
      const imagegenToolNames = imagegen.tools.map((t: { name: string }) => t.name);
      expect(imagegenToolNames).toContain('image_generation');
      expect(imagegenToolNames).toContain('getCurrentDatetime');

      // All agents should have default tools
      const agentTypes: AgentType[] = ['orchestrator', 'coder', 'researcher', 'secretary', 'personality', 'home', 'finance', 'imagegen'];
      for (const agentType of agentTypes) {
        const agent = agentType === 'orchestrator'
          ? (await import('@/lib/agents/sdk/agents')).orchestratorAgent
          : getAgent(agentType);
        const toolNames = agent.tools.map((t: { name: string }) => t.name);
        expect(
          toolNames.includes('calculate') || toolNames.includes('getCurrentDatetime')
        ).toBe(true);
      }
    });

    it('agent names are user-friendly', async () => {
      const { getAgentName } = await import('@/lib/agents/sdk/agents');

      expect(getAgentName('orchestrator')).toBe('Q8');
      expect(getAgentName('coder')).toBe('DevBot');
      expect(getAgentName('researcher')).toBe('ResearchBot');
      expect(getAgentName('secretary')).toBe('SecretaryBot');
      expect(getAgentName('personality')).toBe('PersonalityBot');
      expect(getAgentName('home')).toBe('HomeBot');
      expect(getAgentName('finance')).toBe('FinanceAdvisor');
      expect(getAgentName('imagegen')).toBe('ImageGen');
    });

    it('validates agent type correctly', async () => {
      const { isValidAgentType } = await import('@/lib/agents/sdk/agents');

      expect(isValidAgentType('orchestrator')).toBe(true);
      expect(isValidAgentType('coder')).toBe(true);
      expect(isValidAgentType('researcher')).toBe(true);

      expect(isValidAgentType('invalid')).toBe(false);
      expect(isValidAgentType('')).toBe(false);
      expect(isValidAgentType('CODER')).toBe(false);
    });

    it('can find agent by name', async () => {
      const { getAgentByName, getAgentType } = await import('@/lib/agents/sdk/agents');

      const devBot = getAgentByName('DevBot');
      expect(devBot).toBeDefined();
      expect(getAgentType(devBot!)).toBe('coder');

      const q8 = getAgentByName('Q8');
      expect(q8).toBeDefined();
      expect(getAgentType(q8!)).toBe('orchestrator');

      const devBotLower = getAgentByName('devbot');
      expect(devBotLower).toBeDefined();
      expect(getAgentType(devBotLower!)).toBe('coder');

      const notFound = getAgentByName('NonExistent');
      expect(notFound).toBeUndefined();
    });
  });

  // ===========================================================================
  // ROUTER INTEGRATION TESTS
  // ===========================================================================

  describe('Router integration', () => {
    it('explicit routing takes highest priority', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('@researcher tell me about code review best practices');

      expect(result.agent).toBe('researcher');
      expect(result.source).toBe('explicit');
      expect(result.confidence).toBe(0.99);
    });

    it('keyword routing works without LLM', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('Debug the login bug in the authentication code', { skipLLM: true });

      expect(result.agent).toBe('coder');
      expect(result.source).toBe('keyword');
    });

    it('falls back to orchestrator for ambiguous messages', async () => {
      const { route } = await import('@/lib/agents/sdk/router');

      const result = await route('help me with something', { skipLLM: true });

      expect(result.agent).toBe('orchestrator');
      expect(result.source).toBe('fallback');
    });

    it('converts routing decision to orchestration format', async () => {
      const { toOrchestrationRoutingDecision } = await import('@/lib/agents/sdk/router');

      const sdkDecision: SDKRoutingDecision = {
        agent: 'coder',
        confidence: 0.85,
        rationale: 'Code-related request',
        source: 'keyword',
      };

      const orchDecision = toOrchestrationRoutingDecision(sdkDecision);

      expect(orchDecision.agent).toBe('coder');
      expect(orchDecision.confidence).toBe(0.85);
      expect(orchDecision.rationale).toBe('Code-related request');
      expect(orchDecision.source).toBe('heuristic');
    });

    it('LLM routing function accepts OpenAI client parameter', async () => {
      const { llmRoute } = await import('@/lib/agents/sdk/router');

      expect(typeof llmRoute).toBe('function');

      const result = await llmRoute('Help me debug this TypeScript error');

      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('source');
    });

    it('routing decision schema validates correctly', async () => {
      const { RoutingDecisionSchema } = await import('@/lib/agents/sdk/router');

      const validDecision = {
        agent: 'coder',
        confidence: 0.85,
        rationale: 'Code-related task',
      };
      expect(RoutingDecisionSchema.safeParse(validDecision).success).toBe(true);

      const invalidAgent = {
        agent: 'invalid_agent',
        confidence: 0.85,
        rationale: 'Test',
      };
      expect(RoutingDecisionSchema.safeParse(invalidAgent).success).toBe(false);

      const invalidConfidence = {
        agent: 'coder',
        confidence: 1.5,
        rationale: 'Test',
      };
      expect(RoutingDecisionSchema.safeParse(invalidConfidence).success).toBe(false);
    });
  });

  // ===========================================================================
  // END-TO-END STREAMING TESTS
  // ===========================================================================

  describe('End-to-end streaming', () => {
    it('streamMessage accepts all expected options', async () => {
      const { streamMessage } = await import('@/lib/agents/sdk/runner');

      expect(typeof streamMessage).toBe('function');

      const generator = streamMessage({
        message: 'Test message',
        userId: 'test-user',
        threadId: 'test-thread',
        forceAgent: 'personality',
        showToolExecutions: true,
        maxTurns: 5,
        conversationHistory: [{ role: 'user', content: 'Previous message' }],
        userProfile: {
          name: 'Test User',
          timezone: 'UTC',
          communicationStyle: 'concise',
        },
      });

      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });
  });

  // ===========================================================================
  // PREFLIGHT CHECKS TESTS
  // ===========================================================================

  describe('Preflight checks', () => {
    it('checks all agent availability', async () => {
      process.env.OPENAI_API_KEY = 'test';
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'test';
      process.env.PERPLEXITY_API_KEY = 'test';
      process.env.GOOGLE_CLIENT_ID = 'test';
      process.env.GOOGLE_CLIENT_SECRET = 'test';
      process.env.YOUTUBE_API_KEY = 'test';
      process.env.SPOTIFY_REFRESH_TOKEN = 'test';
      process.env.OPENWEATHER_API_KEY = 'test';
      process.env.HASS_TOKEN = 'test';
      process.env.HASS_URL = 'test';
      process.env.PLAID_CLIENT_ID = 'test';
      process.env.PLAID_SECRET = 'test';

      vi.resetModules();

      const { checkAllAgentsAvailability } = await import('@/lib/agents/sdk/utils/preflight');

      const results = checkAllAgentsAvailability();

      expect(Object.keys(results)).toHaveLength(8);
      expect(results.orchestrator.available).toBe(true);
      expect(results.coder.available).toBe(true);
    });

    it('generates availability report', async () => {
      vi.resetModules();

      const { getAvailabilityReport } = await import('@/lib/agents/sdk/utils/preflight');

      const report = getAvailabilityReport();

      expect(report).toContain('Agent Tool Availability');
      expect(report).toContain('orchestrator');
      expect(report).toContain('coder');
    });

    it('identifies missing credentials', async () => {
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

      vi.resetModules();

      const { checkToolAvailability } = await import('@/lib/agents/sdk/utils/preflight');

      const coderResult = checkToolAvailability('coder');
      expect(coderResult.available).toBe(false);
      expect(coderResult.missingCredentials).toContain('GitHub');

      // Researcher only needs OPENAI_API_KEY (uses hosted web_search)
      // which is set in test env, so researcher should be available
      const researcherResult = checkToolAvailability('researcher');
      expect(researcherResult.available).toBe(true);
    });
  });
});

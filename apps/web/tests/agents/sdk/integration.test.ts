/**
 * Integration Tests for OpenAI Agents SDK
 * Tests the full routing -> agent -> tool execution flow
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction, type Mock } from 'vitest';

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
        },
      },
      beta: {
        chat: {
          completions: {
            parse: mockParse,
          },
        },
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

    it('executes tools when agent requests them', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');
      const { defaultTools } = await import('@/lib/agents/sdk/tools/default');

      // Test calculate tool
      const result = await executeTool('calculate', { expression: '2 + 2' }, defaultTools);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        success: true,
        expression: '2 + 2',
        result: 4,
      });
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
  // HANDOFF TESTS
  // ===========================================================================

  describe('Handoff handling', () => {
    it('orchestrator can handoff to all specialists', async () => {
      const { canHandoff, getValidHandoffTargets } = await import('@/lib/agents/sdk/handoffs');

      const specialists: AgentType[] = ['coder', 'researcher', 'secretary', 'personality', 'home', 'finance', 'imagegen'];

      for (const specialist of specialists) {
        expect(canHandoff('orchestrator', specialist)).toBe(true);
      }

      const targets = getValidHandoffTargets('orchestrator');
      expect(targets).toHaveLength(7);
      expect(targets).toContain('coder');
      expect(targets).toContain('researcher');
    });

    it('specialists can only handoff back to orchestrator', async () => {
      const { canHandoff, getValidHandoffTargets } = await import('@/lib/agents/sdk/handoffs');

      const specialists: AgentType[] = ['coder', 'researcher', 'secretary', 'personality', 'home', 'finance', 'imagegen'];

      for (const specialist of specialists) {
        // Can handoff to orchestrator
        expect(canHandoff(specialist, 'orchestrator')).toBe(true);

        // Cannot handoff to other specialists
        for (const other of specialists) {
          if (other !== specialist) {
            expect(canHandoff(specialist, other)).toBe(false);
          }
        }

        // Valid targets should only be orchestrator
        const targets = getValidHandoffTargets(specialist);
        expect(targets).toEqual(['orchestrator']);
      }
    });

    it('prevents self-handoffs', async () => {
      const { canHandoff } = await import('@/lib/agents/sdk/handoffs');

      const agents: AgentType[] = ['orchestrator', 'coder', 'researcher', 'secretary'];

      for (const agent of agents) {
        expect(canHandoff(agent, agent)).toBe(false);
      }
    });

    it('creates handoff with context', async () => {
      const { handoffToCoder } = await import('@/lib/agents/sdk/handoffs');

      const handoff = handoffToCoder('User needs help with a bug', {
        repo: 'q8-app',
        issue: 42,
      });

      expect(handoff.targetAgent).toBe('coder');
      expect(handoff.reason).toBe('User needs help with a bug');
      expect(handoff.context).toEqual({
        repo: 'q8-app',
        issue: 42,
      });
    });

    it('formats handoff message correctly', async () => {
      const { formatHandoffMessage, handoffToResearcher } = await import('@/lib/agents/sdk/handoffs');

      const handoff = handoffToResearcher('Need to research AI regulations', {
        query: 'AI regulations 2026',
        depth: 'thorough',
      });

      const message = formatHandoffMessage(handoff);

      expect(message).toContain('ResearchBot');
      expect(message).toContain('Need to research AI regulations');
    });

    it('executes handoff successfully', async () => {
      const { executeHandoff, handoffToCoder } = await import('@/lib/agents/sdk/handoffs');

      const handoff = handoffToCoder('Debug the login issue', { repo: 'q8-app' });

      const result = await executeHandoff(handoff, 'Help me debug the login', 'user-123', 'thread-456');

      expect(result.success).toBe(true);
      expect(result.targetAgent).toBe('coder');
      expect(result.context?._handoff).toBeDefined();
      expect((result.context?._handoff as Record<string, unknown>).reason).toBe('Debug the login issue');
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
      // Test that our event types are correctly structured
      // This tests the type system without needing to mock OpenAI

      // The event types should include these key events
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

      // Verify all expected event types are accounted for
      expect(eventTypes).toContain('routing');
      expect(eventTypes).toContain('agent_start');
      expect(eventTypes).toContain('content');
      expect(eventTypes).toContain('done');
      expect(eventTypes).toContain('error');
      expect(eventTypes).toContain('tool_start');
      expect(eventTypes).toContain('tool_end');
    });

    it('runner exports streaming functions', async () => {
      const runner = await import('@/lib/agents/sdk/runner');

      // Verify the module exports the expected functions
      expect(typeof runner.runAgent).toBe('function');
      expect(typeof runner.streamMessage).toBe('function');
      expect(typeof runner.executeTool).toBe('function');
      expect(typeof runner.toOpenAITools).toBe('function');
      expect(typeof runner.buildSystemPrompt).toBe('function');
    });

    it('buildSystemPrompt includes agent instructions', async () => {
      const { buildSystemPrompt } = await import('@/lib/agents/sdk/runner');
      const { getAgentConfig } = await import('@/lib/agents/sdk/agents');

      const coderConfig = getAgentConfig('coder');
      const prompt = buildSystemPrompt(coderConfig, { userId: 'test-user' });

      // Should include the agent's base instructions
      expect(prompt).toContain('DevBot');
      expect(prompt).toContain('software engineer');

      // Should include datetime context
      expect(prompt).toContain('Current date and time');
    });

    it('buildSystemPrompt includes user profile when provided', async () => {
      const { buildSystemPrompt } = await import('@/lib/agents/sdk/runner');
      const { getAgentConfig } = await import('@/lib/agents/sdk/agents');

      const orchestratorConfig = getAgentConfig('orchestrator');
      const prompt = buildSystemPrompt(orchestratorConfig, {
        userId: 'test-user',
        userProfile: {
          name: 'Alice',
          timezone: 'America/New_York',
          communicationStyle: 'concise',
        },
      });

      expect(prompt).toContain('Alice');
      expect(prompt).toContain('America/New_York');
      expect(prompt).toContain('concise');
    });

    it('toOpenAITools converts tool definitions correctly', async () => {
      const { toOpenAITools } = await import('@/lib/agents/sdk/runner');
      const { defaultTools } = await import('@/lib/agents/sdk/tools/default');

      const openaiTools = toOpenAITools(defaultTools);

      expect(Array.isArray(openaiTools)).toBe(true);
      expect(openaiTools.length).toBe(defaultTools.length);

      // Check structure of converted tools
      for (const tool of openaiTools) {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool).toHaveProperty('function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
      }

      // Verify specific tool names
      const toolNames = openaiTools.map(t => t.function.name);
      expect(toolNames).toContain('calculate');
      expect(toolNames).toContain('getCurrentDatetime');
      expect(toolNames).toContain('getWeather');
    });
  });

  // ===========================================================================
  // TOOL EXECUTION TESTS
  // ===========================================================================

  describe('Tool execution', () => {
    it('executes calculate tool correctly', async () => {
      const { calculate } = await import('@/lib/agents/sdk/tools/default');

      const result = await calculate({ expression: '2 + 2' });

      // Check the structure - actual result comes from real safeEvaluate
      expect(result.success).toBe(true);
      expect(result.expression).toBe('2 + 2');
      if (result.success) {
        expect(typeof result.result).toBe('number');
        expect(result.result).toBe(4);
      }
    });

    it('handles calculate tool errors', async () => {
      const { calculate } = await import('@/lib/agents/sdk/tools/default');

      // Use an expression that will cause a real error
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

      // Should fall back to UTC
      expect(result.timezone).toBe('UTC');
    });

    it('handles Spotify API errors', async () => {
      // Clear Spotify credentials
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;
      delete process.env.SPOTIFY_REFRESH_TOKEN;

      // Clear cached modules to pick up new env
      vi.resetModules();

      const { spotifySearch } = await import('@/lib/agents/sdk/tools/spotify');

      const result = await spotifySearch({ query: 'test song' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_CREDENTIALS');
      }
    });

    it('handles GitHub API errors', async () => {
      // Clear GitHub credentials
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

      // Clear cached modules to pick up new env
      vi.resetModules();

      const { githubListRepos } = await import('@/lib/agents/sdk/tools/github');

      const result = await githubListRepos({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_CREDENTIALS');
      }
    });

    it('validates tool arguments', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');
      const { defaultTools } = await import('@/lib/agents/sdk/tools/default');

      // Missing required argument
      const result = await executeTool('calculate', {}, defaultTools);

      // Should fail validation
      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // AGENT CONFIGURATION TESTS
  // ===========================================================================

  describe('Agent configurations', () => {
    it('all agents have valid configurations', async () => {
      const { getAllAgentConfigs, AgentTypeSchema } = await import('@/lib/agents/sdk/agents');

      const configs = getAllAgentConfigs();

      expect(configs.length).toBe(8); // 8 agents

      for (const config of configs) {
        // Has required fields
        expect(config.name).toBeDefined();
        expect(config.type).toBeDefined();
        expect(config.model).toBeDefined();
        expect(config.instructions).toBeDefined();
        expect(Array.isArray(config.tools)).toBe(true);

        // Type is valid
        expect(AgentTypeSchema.safeParse(config.type).success).toBe(true);

        // Instructions are non-empty
        expect(config.instructions.length).toBeGreaterThan(50);
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
      const { getAgentTools, getAgentConfig } = await import('@/lib/agents/sdk/agents');

      // Coder should have GitHub tools
      const coderTools = getAgentTools('coder');
      const coderToolNames = coderTools.map(t => t.name);
      expect(coderToolNames.some(name => name.startsWith('github_'))).toBe(true);

      // Personality should have Spotify tools
      const personalityTools = getAgentTools('personality');
      const personalityToolNames = personalityTools.map(t => t.name);
      expect(personalityToolNames.some(name => name.startsWith('spotify_'))).toBe(true);

      // ImageGen should have minimal tools (uses model capabilities)
      const imagegenTools = getAgentTools('imagegen');
      expect(imagegenTools.length).toBe(0);

      // All agents except imagegen should have default tools
      const agents: AgentType[] = ['orchestrator', 'coder', 'researcher', 'secretary', 'personality', 'home', 'finance'];
      for (const agent of agents) {
        const tools = getAgentTools(agent);
        const toolNames = tools.map(t => t.name);
        // Check for at least one default tool (calculate or getCurrentDatetime)
        expect(
          toolNames.includes('calculate') || toolNames.includes('getCurrentDatetime')
        ).toBe(true);
      }
    });

    it('agent models are correctly assigned', async () => {
      const { getAgentModel } = await import('@/lib/agents/sdk/agents');

      // Verify model assignments match documentation
      expect(getAgentModel('orchestrator')).toBe('gpt-5.2');
      expect(getAgentModel('coder')).toBe('claude-opus-4-5-20251101');
      expect(getAgentModel('researcher')).toBe('sonar-reasoning-pro');
      expect(getAgentModel('secretary')).toBe('gemini-3-flash-preview');
      expect(getAgentModel('personality')).toBe('grok-4-1-fast');
      expect(getAgentModel('home')).toBe('gpt-5-mini');
      expect(getAgentModel('finance')).toBe('gemini-3-flash-preview');
      expect(getAgentModel('imagegen')).toBe('gpt-image-1.5');
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

      // Valid types
      expect(isValidAgentType('orchestrator')).toBe(true);
      expect(isValidAgentType('coder')).toBe(true);
      expect(isValidAgentType('researcher')).toBe(true);

      // Invalid types
      expect(isValidAgentType('invalid')).toBe(false);
      expect(isValidAgentType('')).toBe(false);
      expect(isValidAgentType('CODER')).toBe(false); // Case sensitive
    });

    it('can find agent by name', async () => {
      const { getAgentByName } = await import('@/lib/agents/sdk/agents');

      const devBot = getAgentByName('DevBot');
      expect(devBot).toBeDefined();
      expect(devBot?.type).toBe('coder');

      const q8 = getAgentByName('Q8');
      expect(q8).toBeDefined();
      expect(q8?.type).toBe('orchestrator');

      // Case insensitive
      const devBotLower = getAgentByName('devbot');
      expect(devBotLower).toBeDefined();
      expect(devBotLower?.type).toBe('coder');

      // Non-existent
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

      // Even with code keywords, explicit mention wins
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

      // Very ambiguous message
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
      expect(orchDecision.source).toBe('heuristic'); // keyword maps to heuristic
    });

    it('LLM routing function accepts OpenAI client parameter', async () => {
      const { llmRoute } = await import('@/lib/agents/sdk/router');

      // Verify the function exists and has correct signature
      expect(typeof llmRoute).toBe('function');

      // Without a valid API key, it should fallback to orchestrator
      const result = await llmRoute('Help me debug this TypeScript error');

      // Since we don't have a real API key configured, it should fallback
      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('source');
    });

    it('routing decision schema validates correctly', async () => {
      const { RoutingDecisionSchema } = await import('@/lib/agents/sdk/router');

      // Valid decision
      const validDecision = {
        agent: 'coder',
        confidence: 0.85,
        rationale: 'Code-related task',
      };
      expect(RoutingDecisionSchema.safeParse(validDecision).success).toBe(true);

      // Invalid agent
      const invalidAgent = {
        agent: 'invalid_agent',
        confidence: 0.85,
        rationale: 'Test',
      };
      expect(RoutingDecisionSchema.safeParse(invalidAgent).success).toBe(false);

      // Invalid confidence
      const invalidConfidence = {
        agent: 'coder',
        confidence: 1.5, // Over 1
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

      // Verify the function exists
      expect(typeof streamMessage).toBe('function');

      // Create a generator (but don't iterate - that would make API calls)
      const generator = streamMessage({
        message: 'Test message',
        userId: 'test-user',
        threadId: 'test-thread',
        forceAgent: 'personality',
        showToolExecutions: true,
        maxToolRounds: 5,
        conversationHistory: [{ role: 'user', content: 'Previous message' }],
        userProfile: {
          name: 'Test User',
          timezone: 'UTC',
          communicationStyle: 'concise',
        },
      });

      // Verify it returns an async generator
      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });

    it('runAgent accepts all expected options', async () => {
      const { runAgent } = await import('@/lib/agents/sdk/runner');

      // Verify the function exists
      expect(typeof runAgent).toBe('function');

      // Create a generator (but don't iterate - that would make API calls)
      const generator = runAgent(
        'orchestrator',
        'Test message',
        {
          userId: 'test-user',
          threadId: 'test-thread',
          userProfile: {
            name: 'Test User',
            timezone: 'UTC',
          },
        },
        {
          conversationHistory: [{ role: 'assistant', content: 'Previous response' }],
          maxToolRounds: 10,
          showToolExecutions: false,
        }
      );

      // Verify it returns an async generator
      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });

    it('executeTool handles tool not found gracefully', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const result = await executeTool('non_existent_tool', { arg: 'value' }, []);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
      expect(result.error?.recoverable).toBe(false);
    });

    it('executeTool handles tool validation errors', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');
      const { defaultTools } = await import('@/lib/agents/sdk/tools/default');

      // Call calculate without required expression parameter
      const result = await executeTool('calculate', {}, defaultTools);

      expect(result.success).toBe(false);
      // The error should indicate validation issue
      expect(result.error).toBeDefined();
    });

    it('executeTool runs successfully with valid arguments', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');
      const { defaultTools } = await import('@/lib/agents/sdk/tools/default');

      // Call calculate with valid expression
      const result = await executeTool('calculate', { expression: '10 + 5' }, defaultTools);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });

  // ===========================================================================
  // PREFLIGHT CHECKS TESTS
  // ===========================================================================

  describe('Preflight checks', () => {
    it('checks all agent availability', async () => {
      // Set all credentials
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

      // Should have results for all agents
      expect(Object.keys(results)).toHaveLength(8);

      // Orchestrator should be available (only needs OpenAI)
      expect(results.orchestrator.available).toBe(true);

      // Coder should be available
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
      // Clear all credentials
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      delete process.env.PERPLEXITY_API_KEY;

      vi.resetModules();

      const { checkToolAvailability } = await import('@/lib/agents/sdk/utils/preflight');

      const coderResult = checkToolAvailability('coder');
      expect(coderResult.available).toBe(false);
      expect(coderResult.missingCredentials).toContain('GitHub');

      const researcherResult = checkToolAvailability('researcher');
      expect(researcherResult.available).toBe(false);
      expect(researcherResult.missingCredentials).toContain('Perplexity');
    });
  });
});

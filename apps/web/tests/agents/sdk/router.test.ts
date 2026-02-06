/**
 * Tests for gpt-5-nano Router with OpenAI Structured Outputs
 * TDD tests for intelligent agent routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI before imports
const mockParse = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        parse: mockParse,
      },
    };
  },
}));

// Import after mock
import {
  route,
  checkExplicitAgentRequest,
  keywordRoute,
  llmRoute,
  toOrchestrationRoutingDecision,
  ROUTABLE_AGENTS,
  type SDKRoutingDecision,
  type RoutableAgent,
} from '@/lib/agents/sdk/router';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockLLMResponse(
  agent: RoutableAgent,
  confidence: number,
  rationale: string
) {
  return {
    choices: [
      {
        message: {
          parsed: {
            agent,
            confidence,
            rationale,
          },
        },
      },
    ],
  };
}

// =============================================================================
// Explicit Agent Request Tests
// =============================================================================

describe('checkExplicitAgentRequest', () => {
  it('detects "ask the coder" pattern', () => {
    const result = checkExplicitAgentRequest('ask the coder to review my PR');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('coder');
    expect(result?.source).toBe('explicit');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it('detects "have the researcher" pattern', () => {
    const result = checkExplicitAgentRequest('have the researcher find information about AI');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('researcher');
    expect(result?.source).toBe('explicit');
  });

  it('detects "let the secretary" pattern', () => {
    const result = checkExplicitAgentRequest('let the secretary schedule a meeting');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('secretary');
  });

  it('detects "@coder" mention', () => {
    const result = checkExplicitAgentRequest('@coder fix this bug');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('coder');
  });

  it('detects "@researcher" mention', () => {
    const result = checkExplicitAgentRequest('@researcher what is quantum computing?');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('researcher');
  });

  it('detects "@home" mention', () => {
    const result = checkExplicitAgentRequest('@home turn on the lights');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('home');
  });

  it('detects "@finance" mention', () => {
    const result = checkExplicitAgentRequest('@finance check my spending');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('finance');
  });

  it('detects "@imagegen" mention', () => {
    const result = checkExplicitAgentRequest('@imagegen create a logo');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('imagegen');
  });

  it('detects "ask devbot" pattern', () => {
    const result = checkExplicitAgentRequest('ask devbot to implement this feature');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('coder');
  });

  it('detects "ask Q8" pattern for personality', () => {
    const result = checkExplicitAgentRequest('ask Q8 to tell me a joke');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('personality');
  });

  it('returns null for no explicit mention', () => {
    const result = checkExplicitAgentRequest('what is the weather like today?');
    expect(result).toBeNull();
  });

  it('is case insensitive', () => {
    const result = checkExplicitAgentRequest('ASK THE CODER to help me');
    expect(result).not.toBeNull();
    expect(result?.agent).toBe('coder');
  });
});

// =============================================================================
// Keyword Routing Tests
// =============================================================================

describe('keywordRoute', () => {
  describe('coder agent', () => {
    it('routes code-related queries', () => {
      const result = keywordRoute('review this code for bugs please');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('coder');
      expect(result?.source).toBe('keyword');
    });

    it('routes GitHub-related queries', () => {
      const result = keywordRoute('check the pull request status on github');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('coder');
    });

    it('routes debugging queries', () => {
      const result = keywordRoute('debug this error in the function');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('coder');
    });

    it('routes SQL queries', () => {
      const result = keywordRoute('write a database sql query to get users');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('coder');
    });
  });

  describe('researcher agent', () => {
    it('routes search queries', () => {
      const result = keywordRoute('search for the latest AI research papers');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('researcher');
    });

    it('routes news queries', () => {
      const result = keywordRoute('what is the latest news about technology');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('researcher');
    });

    it('routes "tell me about" queries', () => {
      const result = keywordRoute('tell me about quantum computing');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('researcher');
    });
  });

  describe('secretary agent', () => {
    it('routes calendar queries', () => {
      const result = keywordRoute('schedule a meeting for tomorrow on my calendar');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('secretary');
    });

    it('routes email queries', () => {
      const result = keywordRoute('send an email to John about the project meeting');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('secretary');
    });

    it('routes YouTube queries', () => {
      const result = keywordRoute('search youtube for cooking video tutorials');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('secretary');
    });
  });

  describe('personality agent', () => {
    it('routes music queries', () => {
      const result = keywordRoute('play some music on spotify please');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('personality');
    });

    it('routes casual chat', () => {
      const result = keywordRoute('hello, how are you doing today? lets chat');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('personality');
    });

    it('routes joke requests', () => {
      const result = keywordRoute('tell me a funny joke please');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('personality');
    });
  });

  describe('home agent', () => {
    it('routes light control queries', () => {
      const result = keywordRoute('turn on the living room lights please');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('home');
    });

    it('routes thermostat queries', () => {
      const result = keywordRoute('set temperature to 72 degrees on thermostat');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('home');
    });

    it('routes scene activation', () => {
      const result = keywordRoute('activate the movie scene with dim lights');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('home');
    });
  });

  describe('finance agent', () => {
    it('routes budget queries', () => {
      const result = keywordRoute('check my monthly budget and spending');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('finance');
    });

    it('routes spending queries', () => {
      const result = keywordRoute('what is my spending summary for this month');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('finance');
    });

    it('routes affordability queries', () => {
      const result = keywordRoute('can i afford a new laptop with my budget?');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('finance');
    });
  });

  describe('imagegen agent', () => {
    it('routes image generation queries', () => {
      const result = keywordRoute('generate an image of a beautiful sunset picture');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('imagegen');
    });

    it('routes diagram creation queries', () => {
      const result = keywordRoute('create a diagram of the system architecture please');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('imagegen');
    });

    it('routes chart creation queries', () => {
      const result = keywordRoute('make a pie chart graph of my monthly expenses');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('imagegen');
    });
  });

  describe('edge cases', () => {
    it('returns null for ambiguous messages', () => {
      const result = keywordRoute('hmm interesting');
      expect(result).toBeNull();
    });

    it('returns null for very short messages', () => {
      const result = keywordRoute('ok');
      expect(result).toBeNull();
    });

    it('uses higher score for multi-word phrase matches', () => {
      // "pull request" is a phrase match (3 points) vs single word matches
      const result = keywordRoute('review my pull request');
      expect(result).not.toBeNull();
      expect(result?.agent).toBe('coder');
      expect(result?.confidence).toBeGreaterThan(0.7);
    });

    it('handles mixed signals by choosing highest score', () => {
      // This message has both research and code signals
      const result = keywordRoute('search for code examples for debugging');
      expect(result).not.toBeNull();
      // Should pick one with higher score
      expect(['coder', 'researcher']).toContain(result?.agent);
    });
  });
});

// =============================================================================
// LLM Routing Tests
// =============================================================================

describe('llmRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls OpenAI with correct parameters', async () => {
    mockParse.mockResolvedValueOnce(
      createMockLLMResponse('coder', 0.9, 'Code-related request')
    );

    const result = await llmRoute('fix the bug in my code');

    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(result.agent).toBe('coder');
    expect(result.confidence).toBe(0.9);
    expect(result.source).toBe('llm');
  });

  it('returns parsed routing decision', async () => {
    mockParse.mockResolvedValueOnce(
      createMockLLMResponse('researcher', 0.85, 'Research query detected')
    );

    const result = await llmRoute('what is the latest news about AI');

    expect(result).toEqual({
      agent: 'researcher',
      confidence: 0.85,
      rationale: 'Research query detected',
      source: 'llm',
    });
  });

  it('falls back to orchestrator on API error', async () => {
    mockParse.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await llmRoute('some message');

    expect(result.agent).toBe('orchestrator');
    expect(result.source).toBe('fallback');
    expect(result.confidence).toBe(0.5);
  });

  it('falls back to orchestrator when no parsed response', async () => {
    mockParse.mockResolvedValueOnce({
      choices: [{ message: { parsed: null } }],
    });

    const result = await llmRoute('some message');

    expect(result.agent).toBe('orchestrator');
    expect(result.source).toBe('fallback');
  });
});

// =============================================================================
// Main Route Function Tests
// =============================================================================

describe('route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('explicit agent routing (priority 1)', () => {
    it('routes to explicit agent without LLM call', async () => {
      const result = await route('ask the coder to review my PR');

      expect(result.agent).toBe('coder');
      expect(result.source).toBe('explicit');
      expect(mockParse).not.toHaveBeenCalled();
    });

    it('routes @mention without LLM call', async () => {
      const result = await route('@researcher find AI papers');

      expect(result.agent).toBe('researcher');
      expect(result.source).toBe('explicit');
      expect(mockParse).not.toHaveBeenCalled();
    });
  });

  describe('keyword routing (priority 2)', () => {
    it('routes high-confidence keyword match without LLM', async () => {
      // Multiple keyword matches should exceed threshold
      const result = await route('debug this code bug in the function', {
        keywordConfidenceThreshold: 0.75,
      });

      expect(result.agent).toBe('coder');
      expect(result.source).toBe('keyword');
      expect(mockParse).not.toHaveBeenCalled();
    });

    it('routes with skipLLM option', async () => {
      const result = await route('play some music on spotify', { skipLLM: true });

      expect(result.agent).toBe('personality');
      expect(result.source).toBe('keyword');
      expect(mockParse).not.toHaveBeenCalled();
    });
  });

  describe('LLM routing (priority 3)', () => {
    it('uses LLM for low-confidence keyword matches', async () => {
      mockParse.mockResolvedValueOnce(
        createMockLLMResponse('secretary', 0.9, 'Scheduling request')
      );

      // "meeting" alone gives low confidence
      const result = await route('meeting', {
        keywordConfidenceThreshold: 0.9,
      });

      expect(mockParse).toHaveBeenCalled();
    });

    it('boosts confidence when LLM and keyword agree', async () => {
      mockParse.mockResolvedValueOnce(
        createMockLLMResponse('coder', 0.88, 'Code review request')
      );

      // Using a query that gets moderate keyword score (code + bug = 2 pts, 0.75 conf)
      // but LLM is still more confident (0.88 > 0.75), so LLM wins and gets boosted
      const result = await route('check the code for bug', {
        keywordConfidenceThreshold: 0.99, // Force LLM call since 0.75 < 0.99
      });

      // Should boost confidence since both agree (+0.1 boost)
      // 0.88 + 0.1 = 0.98
      expect(result.agent).toBe('coder');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      expect(result.rationale).toContain('confirmed by keyword match');
    });

    it('uses LLM result when more confident than keyword', async () => {
      mockParse.mockResolvedValueOnce(
        createMockLLMResponse('finance', 0.95, 'Financial query')
      );

      const result = await route('how much did I spend', {
        keywordConfidenceThreshold: 0.99, // Force LLM call
      });

      expect(result.agent).toBe('finance');
      expect(result.source).toBe('llm');
    });
  });

  describe('fallback routing (priority 4)', () => {
    it('falls back to orchestrator for ambiguous messages', async () => {
      const result = await route('hmm interesting', { skipLLM: true });

      expect(result.agent).toBe('orchestrator');
      expect(result.source).toBe('fallback');
    });

    it('falls back to orchestrator when no API key', async () => {
      vi.stubEnv('OPENAI_API_KEY', '');

      const result = await route('some unclear request');

      expect(result.agent).toBe('orchestrator');
      expect(mockParse).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Type Conversion Tests
// =============================================================================

describe('toOrchestrationRoutingDecision', () => {
  it('converts explicit source to heuristic', () => {
    const decision: SDKRoutingDecision = {
      agent: 'coder',
      confidence: 0.99,
      rationale: 'Explicit request',
      source: 'explicit',
    };

    const result = toOrchestrationRoutingDecision(decision);

    expect(result.source).toBe('heuristic');
    expect(result.agent).toBe('coder');
  });

  it('converts keyword source to heuristic', () => {
    const decision: SDKRoutingDecision = {
      agent: 'researcher',
      confidence: 0.85,
      rationale: 'Keyword match',
      source: 'keyword',
    };

    const result = toOrchestrationRoutingDecision(decision);

    expect(result.source).toBe('heuristic');
  });

  it('preserves llm source', () => {
    const decision: SDKRoutingDecision = {
      agent: 'secretary',
      confidence: 0.9,
      rationale: 'LLM classification',
      source: 'llm',
    };

    const result = toOrchestrationRoutingDecision(decision);

    expect(result.source).toBe('llm');
  });

  it('preserves fallback source', () => {
    const decision: SDKRoutingDecision = {
      agent: 'orchestrator',
      confidence: 0.5,
      rationale: 'Fallback',
      source: 'fallback',
    };

    const result = toOrchestrationRoutingDecision(decision);

    expect(result.source).toBe('fallback');
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('ROUTABLE_AGENTS', () => {
  it('contains all expected agents', () => {
    expect(ROUTABLE_AGENTS).toContain('orchestrator');
    expect(ROUTABLE_AGENTS).toContain('coder');
    expect(ROUTABLE_AGENTS).toContain('researcher');
    expect(ROUTABLE_AGENTS).toContain('secretary');
    expect(ROUTABLE_AGENTS).toContain('personality');
    expect(ROUTABLE_AGENTS).toContain('home');
    expect(ROUTABLE_AGENTS).toContain('finance');
    expect(ROUTABLE_AGENTS).toContain('imagegen');
  });

  it('has exactly 8 agents', () => {
    expect(ROUTABLE_AGENTS.length).toBe(8);
  });
});

/**
 * Tests for Handoff Pattern Implementation
 * TDD tests for agent coordination via handoffs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the router module - must be before imports
vi.mock('@/lib/agents/sdk/router', () => ({
  route: vi.fn(),
}));

// Import after mocks
import { route } from '@/lib/agents/sdk/router';
import {
  // Handoff creation
  createHandoffToAgent,
  handoffToCoder,
  handoffToResearcher,
  handoffToSecretary,
  handoffToPersonality,
  handoffToHome,
  handoffToFinance,
  handoffToImageGen,
  handoffToOrchestrator,
  // Handoff decision
  decideHandoff,
  HANDOFF_CONFIDENCE_THRESHOLD,
  // Handoff execution
  executeHandoff,
  // Utilities
  canHandoff,
  formatHandoffMessage,
  getHandoffTargetName,
  isHandoffTarget,
  getValidHandoffTargets,
  // Types
  type Handoff,
  type HandoffDecision,
  type HandoffResult,
} from '@/lib/agents/sdk/handoffs';
import type { AgentType } from '@/lib/agents/sdk/agents';
import type { SDKRoutingDecision } from '@/lib/agents/sdk/router';

// Get the mocked function
const mockRoute = vi.mocked(route);

// =============================================================================
// Test Helpers
// =============================================================================

function createMockRoutingDecision(
  agent: AgentType,
  confidence: number,
  rationale: string = 'Test rationale'
): SDKRoutingDecision {
  return {
    agent,
    confidence,
    rationale,
    source: 'llm',
  };
}

// =============================================================================
// Handoff Creation Tests
// =============================================================================

describe('createHandoffToAgent', () => {
  it('creates a handoff with required fields', () => {
    const handoff = createHandoffToAgent('coder', 'Code review needed');

    expect(handoff).toEqual({
      targetAgent: 'coder',
      reason: 'Code review needed',
      context: undefined,
    });
  });

  it('creates a handoff with optional context', () => {
    const context = { repo: 'my-repo', issue: 42 };
    const handoff = createHandoffToAgent('coder', 'Fix bug', context);

    expect(handoff.targetAgent).toBe('coder');
    expect(handoff.reason).toBe('Fix bug');
    expect(handoff.context).toEqual(context);
  });

  it('allows handoff to any agent type', () => {
    const agents: AgentType[] = [
      'orchestrator',
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
      'imagegen',
    ];

    agents.forEach((agent) => {
      const handoff = createHandoffToAgent(agent, 'Test reason');
      expect(handoff.targetAgent).toBe(agent);
    });
  });
});

describe('handoffToCoder', () => {
  it('creates a coder handoff', () => {
    const handoff = handoffToCoder('Review this PR');

    expect(handoff.targetAgent).toBe('coder');
    expect(handoff.reason).toBe('Review this PR');
  });

  it('includes coder-specific context', () => {
    const handoff = handoffToCoder('Fix issue', {
      repo: 'q8-app',
      issue: 123,
      branch: 'fix/bug',
    });

    expect(handoff.context).toEqual({
      repo: 'q8-app',
      issue: 123,
      branch: 'fix/bug',
    });
  });
});

describe('handoffToResearcher', () => {
  it('creates a researcher handoff', () => {
    const handoff = handoffToResearcher('Find information');

    expect(handoff.targetAgent).toBe('researcher');
    expect(handoff.reason).toBe('Find information');
  });

  it('includes researcher-specific context', () => {
    const handoff = handoffToResearcher('Research topic', {
      query: 'AI trends 2026',
      depth: 'thorough',
    });

    expect(handoff.context).toEqual({
      query: 'AI trends 2026',
      depth: 'thorough',
    });
  });
});

describe('handoffToSecretary', () => {
  it('creates a secretary handoff', () => {
    const handoff = handoffToSecretary('Schedule meeting');

    expect(handoff.targetAgent).toBe('secretary');
    expect(handoff.reason).toBe('Schedule meeting');
  });

  it('includes secretary-specific context', () => {
    const handoff = handoffToSecretary('Send email', {
      emailTo: 'team@example.com',
      meetingDate: '2026-02-10',
    });

    expect(handoff.context).toEqual({
      emailTo: 'team@example.com',
      meetingDate: '2026-02-10',
    });
  });
});

describe('handoffToPersonality', () => {
  it('creates a personality handoff', () => {
    const handoff = handoffToPersonality('Casual conversation');

    expect(handoff.targetAgent).toBe('personality');
    expect(handoff.reason).toBe('Casual conversation');
  });

  it('includes personality-specific context', () => {
    const handoff = handoffToPersonality('Play music', {
      mood: 'happy',
      style: 'playful',
    });

    expect(handoff.context).toEqual({
      mood: 'happy',
      style: 'playful',
    });
  });
});

describe('handoffToHome', () => {
  it('creates a home handoff', () => {
    const handoff = handoffToHome('Control lights');

    expect(handoff.targetAgent).toBe('home');
    expect(handoff.reason).toBe('Control lights');
  });

  it('includes home-specific context', () => {
    const handoff = handoffToHome('Turn on lights', {
      device: 'living-room-light',
      room: 'living room',
      action: 'turn_on',
    });

    expect(handoff.context).toEqual({
      device: 'living-room-light',
      room: 'living room',
      action: 'turn_on',
    });
  });
});

describe('handoffToFinance', () => {
  it('creates a finance handoff', () => {
    const handoff = handoffToFinance('Check budget');

    expect(handoff.targetAgent).toBe('finance');
    expect(handoff.reason).toBe('Check budget');
  });

  it('includes finance-specific context', () => {
    const handoff = handoffToFinance('Analyze spending', {
      category: 'food',
      period: 'monthly',
    });

    expect(handoff.context).toEqual({
      category: 'food',
      period: 'monthly',
    });
  });
});

describe('handoffToImageGen', () => {
  it('creates an imagegen handoff', () => {
    const handoff = handoffToImageGen('Generate image');

    expect(handoff.targetAgent).toBe('imagegen');
    expect(handoff.reason).toBe('Generate image');
  });

  it('includes imagegen-specific context', () => {
    const handoff = handoffToImageGen('Create artwork', {
      style: 'photorealistic',
      size: '1024x1024',
      quality: 'hd',
    });

    expect(handoff.context).toEqual({
      style: 'photorealistic',
      size: '1024x1024',
      quality: 'hd',
    });
  });
});

describe('handoffToOrchestrator', () => {
  it('creates an orchestrator handoff', () => {
    const handoff = handoffToOrchestrator('Task complete');

    expect(handoff.targetAgent).toBe('orchestrator');
    expect(handoff.reason).toBe('Task complete');
  });

  it('includes context for return handoffs', () => {
    const handoff = handoffToOrchestrator('Need different expertise', {
      completedTask: 'code review',
      nextSuggestion: 'researcher',
    });

    expect(handoff.context).toEqual({
      completedTask: 'code review',
      nextSuggestion: 'researcher',
    });
  });
});

// =============================================================================
// Handoff Decision Tests
// =============================================================================

describe('decideHandoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suggests handoff when routed agent differs from current', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('coder', 0.9, 'Code-related task')
    );

    const decision = await decideHandoff('fix this bug', 'orchestrator');

    expect(decision.shouldHandoff).toBe(true);
    expect(decision.handoff?.targetAgent).toBe('coder');
    expect(decision.handoff?.reason).toBe('Code-related task');
  });

  it('does not suggest handoff when routed to same agent', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('orchestrator', 0.9, 'General query')
    );

    const decision = await decideHandoff('hello', 'orchestrator');

    expect(decision.shouldHandoff).toBe(false);
    expect(decision.handoff).toBeUndefined();
  });

  it('does not suggest handoff when confidence below threshold', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('coder', 0.5, 'Maybe code related')
    );

    const decision = await decideHandoff('maybe fix something', 'orchestrator');

    expect(decision.shouldHandoff).toBe(false);
    expect(decision.routingDecision?.confidence).toBeLessThan(
      HANDOFF_CONFIDENCE_THRESHOLD
    );
  });

  it('suggests handoff when confidence at threshold', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('researcher', 0.7, 'Research task')
    );

    const decision = await decideHandoff('search for AI news', 'orchestrator');

    expect(decision.shouldHandoff).toBe(true);
    expect(decision.routingDecision?.confidence).toBeGreaterThanOrEqual(
      HANDOFF_CONFIDENCE_THRESHOLD
    );
  });

  it('suggests handoff when confidence above threshold', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('secretary', 0.95, 'Calendar task')
    );

    const decision = await decideHandoff(
      'schedule a meeting tomorrow',
      'orchestrator'
    );

    expect(decision.shouldHandoff).toBe(true);
    expect(decision.handoff?.targetAgent).toBe('secretary');
  });

  it('does not suggest handoff from specialist to specialist', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('researcher', 0.9, 'Research needed')
    );

    const decision = await decideHandoff('search for this', 'coder');

    expect(decision.shouldHandoff).toBe(false);
  });

  it('includes routing decision in result', async () => {
    const expectedDecision = createMockRoutingDecision(
      'home',
      0.85,
      'Smart home control'
    );
    mockRoute.mockResolvedValueOnce(expectedDecision);

    const decision = await decideHandoff('turn on lights', 'orchestrator');

    expect(decision.routingDecision).toEqual(expectedDecision);
  });

  it('passes options to router', async () => {
    mockRoute.mockResolvedValueOnce(
      createMockRoutingDecision('personality', 0.8, 'Casual chat')
    );

    await decideHandoff('hello', 'orchestrator', { skipLLM: true });

    expect(mockRoute).toHaveBeenCalledWith('hello', { skipLLM: true });
  });
});

// =============================================================================
// Handoff Execution Tests
// =============================================================================

describe('executeHandoff', () => {
  it('executes a valid handoff successfully', async () => {
    const handoff: Handoff = {
      targetAgent: 'coder',
      reason: 'Code review',
      context: { repo: 'test-repo' },
    };

    const result = await executeHandoff(
      handoff,
      'Review my code',
      'user-123',
      'thread-456'
    );

    expect(result.success).toBe(true);
    expect(result.targetAgent).toBe('coder');
    expect(result.context).toMatchObject({
      repo: 'test-repo',
      _handoff: expect.objectContaining({
        reason: 'Code review',
        userId: 'user-123',
        threadId: 'thread-456',
      }),
    });
  });

  it('includes handoff metadata in context', async () => {
    const handoff: Handoff = {
      targetAgent: 'researcher',
      reason: 'Need research',
    };

    const result = await executeHandoff(handoff, 'Find info', 'user-1');

    expect(result.context?._handoff).toEqual(
      expect.objectContaining({
        reason: 'Need research',
        userId: 'user-1',
        timestamp: expect.any(String),
      })
    );
  });

  it('handles handoff without thread ID', async () => {
    const handoff: Handoff = {
      targetAgent: 'personality',
      reason: 'Chat request',
    };

    const result = await executeHandoff(handoff, 'Hello', 'user-1');

    expect(result.success).toBe(true);
    expect(result.context?._handoff).toMatchObject({
      userId: 'user-1',
      threadId: undefined,
    });
  });

  it('preserves existing context while adding handoff metadata', async () => {
    const handoff: Handoff = {
      targetAgent: 'home',
      reason: 'Smart home control',
      context: { device: 'lamp', room: 'bedroom' },
    };

    const result = await executeHandoff(handoff, 'Turn on lamp', 'user-1');

    expect(result.context).toMatchObject({
      device: 'lamp',
      room: 'bedroom',
      _handoff: expect.any(Object),
    });
  });
});

// =============================================================================
// canHandoff Tests
// =============================================================================

describe('canHandoff', () => {
  describe('orchestrator handoffs', () => {
    it('orchestrator can handoff to coder', () => {
      expect(canHandoff('orchestrator', 'coder')).toBe(true);
    });

    it('orchestrator can handoff to researcher', () => {
      expect(canHandoff('orchestrator', 'researcher')).toBe(true);
    });

    it('orchestrator can handoff to secretary', () => {
      expect(canHandoff('orchestrator', 'secretary')).toBe(true);
    });

    it('orchestrator can handoff to personality', () => {
      expect(canHandoff('orchestrator', 'personality')).toBe(true);
    });

    it('orchestrator can handoff to home', () => {
      expect(canHandoff('orchestrator', 'home')).toBe(true);
    });

    it('orchestrator can handoff to finance', () => {
      expect(canHandoff('orchestrator', 'finance')).toBe(true);
    });

    it('orchestrator can handoff to imagegen', () => {
      expect(canHandoff('orchestrator', 'imagegen')).toBe(true);
    });

    it('orchestrator cannot handoff to itself', () => {
      expect(canHandoff('orchestrator', 'orchestrator')).toBe(false);
    });
  });

  describe('specialist to orchestrator handoffs', () => {
    const specialists: AgentType[] = [
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
      'imagegen',
    ];

    specialists.forEach((specialist) => {
      it(`${specialist} can return to orchestrator`, () => {
        expect(canHandoff(specialist, 'orchestrator')).toBe(true);
      });
    });
  });

  describe('specialist to specialist handoffs (not allowed)', () => {
    it('coder cannot handoff to researcher', () => {
      expect(canHandoff('coder', 'researcher')).toBe(false);
    });

    it('researcher cannot handoff to secretary', () => {
      expect(canHandoff('researcher', 'secretary')).toBe(false);
    });

    it('secretary cannot handoff to personality', () => {
      expect(canHandoff('secretary', 'personality')).toBe(false);
    });

    it('home cannot handoff to finance', () => {
      expect(canHandoff('home', 'finance')).toBe(false);
    });

    it('finance cannot handoff to imagegen', () => {
      expect(canHandoff('finance', 'imagegen')).toBe(false);
    });
  });

  describe('self-handoffs (not allowed)', () => {
    const allAgents: AgentType[] = [
      'orchestrator',
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
      'imagegen',
    ];

    allAgents.forEach((agent) => {
      it(`${agent} cannot handoff to itself`, () => {
        expect(canHandoff(agent, agent)).toBe(false);
      });
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('formatHandoffMessage', () => {
  it('formats basic handoff message', () => {
    const handoff: Handoff = {
      targetAgent: 'coder',
      reason: 'Code review needed',
    };

    const message = formatHandoffMessage(handoff);

    expect(message).toContain('DevBot');
    expect(message).toContain('Code review needed');
  });

  it('includes context in formatted message', () => {
    const handoff: Handoff = {
      targetAgent: 'researcher',
      reason: 'Research required',
      context: { query: 'AI trends' },
    };

    const message = formatHandoffMessage(handoff);

    expect(message).toContain('ResearchBot');
    expect(message).toContain('Research required');
    expect(message).toContain('query');
    expect(message).toContain('AI trends');
  });

  it('excludes internal context keys (starting with _)', () => {
    const handoff: Handoff = {
      targetAgent: 'secretary',
      reason: 'Schedule meeting',
      context: {
        meetingDate: '2026-02-10',
        _internal: 'should not appear',
      },
    };

    const message = formatHandoffMessage(handoff);

    expect(message).toContain('meetingDate');
    expect(message).not.toContain('_internal');
    expect(message).not.toContain('should not appear');
  });

  it('handles empty context', () => {
    const handoff: Handoff = {
      targetAgent: 'personality',
      reason: 'Casual chat',
      context: {},
    };

    const message = formatHandoffMessage(handoff);

    expect(message).toContain('PersonalityBot');
    expect(message).toContain('Casual chat');
    expect(message).not.toContain('()');
  });
});

describe('getHandoffTargetName', () => {
  it('returns correct names for all agents', () => {
    expect(getHandoffTargetName('orchestrator')).toBe('Q8');
    expect(getHandoffTargetName('coder')).toBe('DevBot');
    expect(getHandoffTargetName('researcher')).toBe('ResearchBot');
    expect(getHandoffTargetName('secretary')).toBe('SecretaryBot');
    expect(getHandoffTargetName('personality')).toBe('PersonalityBot');
    expect(getHandoffTargetName('home')).toBe('HomeBot');
    expect(getHandoffTargetName('finance')).toBe('FinanceAdvisor');
    expect(getHandoffTargetName('imagegen')).toBe('ImageGen');
  });
});

describe('isHandoffTarget', () => {
  it('returns true for all specialists', () => {
    expect(isHandoffTarget('coder')).toBe(true);
    expect(isHandoffTarget('researcher')).toBe(true);
    expect(isHandoffTarget('secretary')).toBe(true);
    expect(isHandoffTarget('personality')).toBe(true);
    expect(isHandoffTarget('home')).toBe(true);
    expect(isHandoffTarget('finance')).toBe(true);
    expect(isHandoffTarget('imagegen')).toBe(true);
  });

  it('returns true for orchestrator (for return handoffs)', () => {
    expect(isHandoffTarget('orchestrator')).toBe(true);
  });
});

describe('getValidHandoffTargets', () => {
  it('returns all specialists for orchestrator', () => {
    const targets = getValidHandoffTargets('orchestrator');

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

  it('returns only orchestrator for specialists', () => {
    const specialists: AgentType[] = [
      'coder',
      'researcher',
      'secretary',
      'personality',
      'home',
      'finance',
      'imagegen',
    ];

    specialists.forEach((specialist) => {
      const targets = getValidHandoffTargets(specialist);
      expect(targets).toEqual(['orchestrator']);
    });
  });
});

// =============================================================================
// Confidence Threshold Tests
// =============================================================================

describe('HANDOFF_CONFIDENCE_THRESHOLD', () => {
  it('is set to 0.7', () => {
    expect(HANDOFF_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});

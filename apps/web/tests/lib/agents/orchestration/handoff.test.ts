/**
 * Handoff Module Tests
 * Tests for agent hand-off protocol with context preservation
 */

import { describe, it, expect } from 'vitest';
import {
  mapNameToAgent,
  detectHandoffSignal,
  buildHandoffContext,
  processHandoff,
  createHandoffMarker,
  stripHandoffMarkers,
  isValidHandoff,
  type HandoffSignal,
} from '@/lib/agents/orchestration/handoff';

describe('Handoff Module', () => {
  describe('mapNameToAgent', () => {
    describe('coder variations', () => {
      it.each([
        ['devbot', 'coder'],
        ['dev', 'coder'],
        ['coder', 'coder'],
        ['developer', 'coder'],
        ['code', 'coder'],
        ['programming', 'coder'],
        ['github', 'coder'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('researcher variations', () => {
      it.each([
        ['researchbot', 'researcher'],
        ['research', 'researcher'],
        ['researcher', 'researcher'],
        ['search', 'researcher'],
        ['lookup', 'researcher'],
        ['find', 'researcher'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('secretary variations', () => {
      it.each([
        ['secretary', 'secretary'],
        ['secretarybot', 'secretary'],
        ['calendar', 'secretary'],
        ['email', 'secretary'],
        ['schedule', 'secretary'],
        ['meeting', 'secretary'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('home variations', () => {
      it.each([
        ['homebot', 'home'],
        ['home', 'home'],
        ['smarthome', 'home'],
        ['lights', 'home'],
        ['thermostat', 'home'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('finance variations', () => {
      it.each([
        ['finance', 'finance'],
        ['financebot', 'finance'],
        ['advisor', 'finance'],
        ['money', 'finance'],
        ['budget', 'finance'],
        ['financial', 'finance'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('personality variations', () => {
      it.each([
        ['q8', 'personality'],
        ['personality', 'personality'],
        ['chat', 'personality'],
        ['talk', 'personality'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('imagegen variations', () => {
      it.each([
        ['imagegen', 'imagegen'],
        ['image', 'imagegen'],
        ['picture', 'imagegen'],
        ['photo', 'imagegen'],
        ['generate', 'imagegen'],
      ])('should map "%s" to %s', (name, expected) => {
        expect(mapNameToAgent(name)).toBe(expected);
      });
    });

    describe('edge cases', () => {
      it('should be case insensitive', () => {
        expect(mapNameToAgent('DevBot')).toBe('coder');
        expect(mapNameToAgent('RESEARCHER')).toBe('researcher');
        expect(mapNameToAgent('SeCreTaRy')).toBe('secretary');
      });

      it('should trim whitespace', () => {
        expect(mapNameToAgent('  coder  ')).toBe('coder');
        expect(mapNameToAgent('\tresearcher\n')).toBe('researcher');
      });

      it('should return null for unknown names', () => {
        expect(mapNameToAgent('unknown')).toBeNull();
        expect(mapNameToAgent('random')).toBeNull();
        expect(mapNameToAgent('')).toBeNull();
      });
    });
  });

  describe('detectHandoffSignal', () => {
    describe('explicit marker pattern', () => {
      it('should detect [HANDOFF:agent] markers', () => {
        const result = detectHandoffSignal('[HANDOFF:coder] Need help with code');

        expect(result).not.toBeNull();
        expect(result!.type).toBe('HANDOFF');
        expect(result!.target).toBe('coder');
        expect(result!.reason).toBe('Need help with code');
      });

      it('should detect marker without reason', () => {
        const result = detectHandoffSignal('[HANDOFF:researcher]');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('researcher');
        expect(result!.reason).toBe('Explicit hand-off requested');
      });

      it('should be case insensitive', () => {
        const result = detectHandoffSignal('[handoff:DevBot] some reason');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('coder');
      });

      it('should return null for invalid agent in marker', () => {
        const result = detectHandoffSignal('[HANDOFF:invalid] reason');
        expect(result).toBeNull();
      });
    });

    describe('natural language patterns', () => {
      it('should detect "let me pass to" pattern', () => {
        const result = detectHandoffSignal('Let me pass this to DevBot to help you.');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('coder');
      });

      it('should detect "let me transfer to" pattern', () => {
        const result = detectHandoffSignal('Let me transfer this over to researcher for more info.');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('researcher');
      });

      it('should detect "I\'ll get X to help" pattern', () => {
        const result = detectHandoffSignal("I'll get secretary to help with this scheduling.");

        expect(result).not.toBeNull();
        expect(result!.target).toBe('secretary');
      });

      it('should detect "I will have X to help" pattern', () => {
        // Pattern requires "to help/handle/take care" after agent name
        const result = detectHandoffSignal('I will have finance to help with your budget question.');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('finance');
      });

      it('should detect "X would be better suited" pattern', () => {
        const result = detectHandoffSignal('DevBot would be better suited for this coding task.');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('coder');
      });

      it('should detect "X is better suited" pattern', () => {
        const result = detectHandoffSignal('Researcher is better suited to handle this search.');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('researcher');
      });

      it('should detect "this needs X expertise" pattern', () => {
        const result = detectHandoffSignal("This needs coder's expertise to solve.");

        expect(result).not.toBeNull();
        expect(result!.target).toBe('coder');
      });

      it('should detect "transferring to" pattern', () => {
        const result = detectHandoffSignal('Transferring you to homebot now.');

        expect(result).not.toBeNull();
        expect(result!.target).toBe('home');
      });
    });

    describe('capability limitation patterns', () => {
      it('should detect code-related limitation', () => {
        const result = detectHandoffSignal("I can't write code or access GitHub for you.");

        expect(result).not.toBeNull();
        expect(result!.target).toBe('coder');
        expect(result!.reason).toBe('Agent indicated capability limitation');
      });

      it('should detect search-related limitation', () => {
        const result = detectHandoffSignal("I don't have access to search the web for current info.");

        expect(result).not.toBeNull();
        expect(result!.target).toBe('researcher');
      });

      it('should detect calendar-related limitation', () => {
        const result = detectHandoffSignal("I cannot access your calendar or email.");

        expect(result).not.toBeNull();
        expect(result!.target).toBe('secretary');
      });

      it('should detect smart home limitation', () => {
        const result = detectHandoffSignal("I am not able to control smart home lights.");

        expect(result).not.toBeNull();
        expect(result!.target).toBe('home');
      });
    });

    describe('no handoff detected', () => {
      it('should return null for normal responses', () => {
        const result = detectHandoffSignal('Here is the answer to your question.');
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(detectHandoffSignal('')).toBeNull();
      });

      it('should return null for irrelevant mentions', () => {
        const result = detectHandoffSignal('The coder wrote this function yesterday.');
        expect(result).toBeNull();
      });
    });
  });

  describe('createHandoffMarker', () => {
    it('should create marker with reason', () => {
      const marker = createHandoffMarker('coder', 'Need code help');
      expect(marker).toBe('[HANDOFF:coder] Need code help');
    });

    it('should create marker without reason', () => {
      const marker = createHandoffMarker('researcher');
      expect(marker).toBe('[HANDOFF:researcher]');
    });

    it('should create marker with empty reason', () => {
      const marker = createHandoffMarker('secretary', '');
      expect(marker).toBe('[HANDOFF:secretary]');
    });
  });

  describe('stripHandoffMarkers', () => {
    it('should remove handoff marker and reason (entire line)', () => {
      // The regex removes marker + everything after it until newline
      const response = '[HANDOFF:coder] Need help here.\nLet me check that for you.';
      const stripped = stripHandoffMarkers(response);
      expect(stripped).toBe('Let me check that for you.');
    });

    it('should remove marker line and preserve following content', () => {
      const response = '[HANDOFF:researcher] Reason\nHere is the info.';
      const stripped = stripHandoffMarkers(response);
      expect(stripped).toBe('Here is the info.');
    });

    it('should remove multiple markers on separate lines', () => {
      const response = '[HANDOFF:coder] First\n[HANDOFF:researcher] Second\nActual text here.';
      const stripped = stripHandoffMarkers(response);
      expect(stripped).toBe('Actual text here.');
    });

    it('should handle response with no markers', () => {
      const response = 'This is a normal response.';
      const stripped = stripHandoffMarkers(response);
      expect(stripped).toBe('This is a normal response.');
    });

    it('should trim result', () => {
      const response = '   [HANDOFF:home] reason   ';
      const stripped = stripHandoffMarkers(response);
      expect(stripped).toBe('');
    });

    it('should remove entire single-line response with marker', () => {
      // When marker is on same line as entire content, entire line is removed
      const response = '[HANDOFF:coder] All on one line';
      const stripped = stripHandoffMarkers(response);
      expect(stripped).toBe('');
    });
  });

  describe('isValidHandoff', () => {
    it('should reject handoff to same agent', () => {
      const result = isValidHandoff('coder', 'coder', []);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot hand off to the same agent');
    });

    it('should allow valid handoff', () => {
      const result = isValidHandoff('coder', 'researcher', ['personality']);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should detect circular handoff', () => {
      const result = isValidHandoff('personality', 'coder', ['coder', 'researcher', 'coder']);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Circular hand-off detected');
    });

    it('should allow non-circular repeated agent', () => {
      // Only one 'coder' in last 3, so not circular
      const result = isValidHandoff('personality', 'coder', ['coder', 'researcher', 'finance']);

      expect(result.valid).toBe(true);
    });

    it('should only check last 3 agents', () => {
      // 'coder' appears twice but one is outside the window
      const result = isValidHandoff('personality', 'coder', ['coder', 'secretary', 'home', 'coder', 'finance']);

      expect(result.valid).toBe(true);
    });

    it('should handle empty recent agents', () => {
      const result = isValidHandoff('coder', 'researcher', []);
      expect(result.valid).toBe(true);
    });
  });

  describe('buildHandoffContext', () => {
    it('should build context with basic parameters', async () => {
      const context = await buildHandoffContext(
        'personality',
        'coder',
        [{ role: 'user', content: 'Help me debug this code' }],
        'Code expertise needed'
      );

      expect(context).toContain('Hand-off Context');
      expect(context).toContain('personality');
      expect(context).toContain('Code expertise needed');
      expect(context).toContain('Help me debug this code');
    });

    it('should include recent conversation history', async () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
      ];

      const context = await buildHandoffContext(
        'researcher',
        'coder',
        messages,
        'Hand-off reason'
      );

      expect(context).toContain('First message');
      expect(context).toContain('Second response');
    });

    it('should truncate long messages', async () => {
      const longContent = 'A'.repeat(500);
      const messages = [{ role: 'user', content: longContent }];

      const context = await buildHandoffContext(
        'personality',
        'researcher',
        messages,
        'reason'
      );

      expect(context).toContain('...');
      expect(context.length).toBeLessThan(longContent.length + 500);
    });

    it('should include partial results when provided', async () => {
      const partialResults = { items: ['a', 'b', 'c'], count: 3 };

      const context = await buildHandoffContext(
        'researcher',
        'coder',
        [],
        'reason',
        partialResults
      );

      expect(context).toContain('Partial Results');
      expect(context).toContain('"items"');
      expect(context).toContain('"count"');
    });

    it('should include tool executions when provided', async () => {
      const options = {
        toolExecutions: [
          { tool: 'web_search', success: true, result: { found: true } },
          { tool: 'github_get_pr', success: false },
        ],
      };

      const context = await buildHandoffContext(
        'researcher',
        'coder',
        [],
        'reason',
        undefined,
        options
      );

      expect(context).toContain('Tool Executions');
      expect(context).toContain('web_search');
      expect(context).toContain('github_get_pr');
      expect(context).toContain('✓');
      expect(context).toContain('✗');
    });

    it('should include original intent when provided', async () => {
      const options = {
        userOriginalIntent: 'Build a website with authentication',
      };

      const context = await buildHandoffContext(
        'personality',
        'coder',
        [],
        'reason',
        undefined,
        options
      );

      expect(context).toContain('Original user intent');
      expect(context).toContain('Build a website with authentication');
    });

    it('should include interrupted topic note when provided', async () => {
      const options = {
        interruptedTopic: 'financial planning',
      };

      const context = await buildHandoffContext(
        'finance',
        'researcher',
        [],
        'reason',
        undefined,
        options
      );

      expect(context).toContain('financial planning');
      expect(context).toContain('return to');
    });
  });

  describe('processHandoff', () => {
    it('should process handoff and return result', async () => {
      const handoff: HandoffSignal = {
        type: 'HANDOFF',
        target: 'coder',
        reason: 'Need coding help',
      };

      const state = {
        fromAgent: 'personality' as const,
        userId: 'user-123',
        threadId: 'thread-456',
        message: 'Help me with code',
        conversationHistory: [
          { role: 'user', content: 'Help me with code' },
        ],
      };

      const result = await processHandoff(handoff, state);

      expect(result.targetAgent).toBe('coder');
      expect(result.shouldNotifyUser).toBe(true);
      expect(result.contextPrompt).toContain('personality');
      expect(result.contextPrompt).toContain('Need coding help');
    });

    it('should include partial results in processed handoff', async () => {
      const handoff: HandoffSignal = {
        type: 'HANDOFF',
        target: 'coder',
        reason: 'Continue with code',
      };

      const state = {
        fromAgent: 'researcher' as const,
        userId: 'user-123',
        threadId: 'thread-456',
        message: 'Build on this',
        conversationHistory: [],
        partialResults: { searchResults: ['item1', 'item2'] },
      };

      const result = await processHandoff(handoff, state);

      expect(result.contextPrompt).toContain('searchResults');
      expect(result.contextPrompt).toContain('item1');
    });
  });
});

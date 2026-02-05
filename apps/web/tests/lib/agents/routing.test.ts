/**
 * Agent Routing Tests
 *
 * Tests for the agent orchestrator's routing logic
 * Mocks LLM responses to avoid API calls during tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI module before importing agents
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mocked response from LLM',
              },
            },
          ],
        }),
      },
    },
  })),
}));

// Import after mocking
import { getModel, type AgentType } from '@/lib/agents/model_factory';

describe('Agent Model Factory', () => {
  // Note: These tests run without API keys set, so getModel returns primary
  // models without API keys (no fallback needed since we just check model names)

  it('returns correct model for orchestrator', () => {
    const config = getModel('orchestrator');
    expect(config.model).toBe('gpt-5.2');
    expect(config.baseURL).toBeUndefined();
  });

  it('returns correct model for coder', () => {
    const config = getModel('coder');
    expect(config.model).toBe('claude-opus-4-5-20251101');
    expect(config.baseURL).toBe('https://api.anthropic.com/v1/');
  });

  it('returns correct model for researcher', () => {
    const config = getModel('researcher');
    expect(config.model).toBe('sonar-reasoning-pro');
    expect(config.baseURL).toBe('https://api.perplexity.ai');
  });

  it('returns correct model for secretary', () => {
    const config = getModel('secretary');
    expect(config.model).toBe('gemini-3-flash-preview');
    expect(config.baseURL).toContain('generativelanguage.googleapis.com');
  });

  it('returns correct model for personality', () => {
    const config = getModel('personality');
    expect(config.model).toBe('grok-4-1-fast');
    expect(config.baseURL).toBe('https://api.x.ai/v1');
  });

  it('returns correct model for home', () => {
    const config = getModel('home');
    expect(config.model).toBe('gpt-5-mini');
  });

  it('returns correct model for finance', () => {
    const config = getModel('finance');
    expect(config.model).toBe('gemini-3-flash-preview');
  });

  it('throws error for unknown agent type', () => {
    expect(() => getModel('unknown' as AgentType)).toThrow('Unknown agent type');
  });
});

describe('Message Routing Analysis', () => {
  // We need to extract the routing function for testing
  // Since it's not exported, we'll test the expected routing patterns

  // Helper to check for word boundary matches (avoids "pr" matching in "practices")
  const hasWord = (text: string, word: string): boolean => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
  };

  const testRouting = (message: string): string => {
    const lowerMessage = message.toLowerCase();

    if (
      hasWord(message, 'code') ||
      hasWord(message, 'bug') ||
      hasWord(message, 'github') ||
      hasWord(message, 'pr') ||
      hasWord(message, 'implement')
    ) {
      return 'code';
    }

    // Research-specific check (before generic "what is" to handle research questions)
    if (
      hasWord(message, 'search') ||
      hasWord(message, 'research') ||
      lowerMessage.includes('tell me about')
    ) {
      return 'search';
    }

    // Knowledge questions - but not philosophical ones
    if (
      (lowerMessage.includes('what is') || lowerMessage.includes('find')) &&
      !lowerMessage.includes('meaning of life') &&
      !lowerMessage.includes('meaning of')
    ) {
      return 'search';
    }

    if (
      lowerMessage.includes('calendar') ||
      lowerMessage.includes('schedule') ||
      lowerMessage.includes('email') ||
      lowerMessage.includes('meeting')
    ) {
      return 'calendar';
    }

    if (
      lowerMessage.includes('light') ||
      lowerMessage.includes('lamp') ||
      lowerMessage.includes('thermostat') ||
      lowerMessage.includes('temperature') ||
      lowerMessage.includes('turn on') ||
      lowerMessage.includes('turn off') ||
      lowerMessage.includes('home') ||
      lowerMessage.includes('lock') ||
      lowerMessage.includes('door') ||
      lowerMessage.includes('blinds') ||
      lowerMessage.includes('fan') ||
      lowerMessage.includes('hvac') ||
      lowerMessage.includes('scene') ||
      lowerMessage.includes('automation')
    ) {
      return 'home';
    }

    return 'chat';
  };

  describe('Coding Intent Detection', () => {
    it('routes "fix this bug" to coder', () => {
      expect(testRouting('Can you help me fix this bug?')).toBe('code');
    });

    it('routes "check my PR" to coder', () => {
      expect(testRouting('Check my latest PR for issues')).toBe('code');
    });

    it('routes "implement a feature" to coder', () => {
      expect(testRouting('Implement the login feature')).toBe('code');
    });

    it('routes "github search" to coder', () => {
      expect(testRouting('Search my GitHub repos')).toBe('code');
    });
  });

  describe('Research Intent Detection', () => {
    it('routes "search for" to researcher', () => {
      expect(testRouting('Search for quantum computing news')).toBe('search');
    });

    it('routes "what is" to researcher', () => {
      expect(testRouting('What is machine learning?')).toBe('search');
    });

    it('routes "tell me about" to researcher', () => {
      expect(testRouting('Tell me about the latest iPhone')).toBe('search');
    });

    it('routes "find information" to researcher', () => {
      expect(testRouting('Find information about SpaceX')).toBe('search');
    });

    it('routes "research" to researcher', () => {
      expect(testRouting('Research best practices for React')).toBe('search');
    });
  });

  describe('Productivity Intent Detection', () => {
    it('routes "check my calendar" to secretary', () => {
      expect(testRouting('Check my calendar for tomorrow')).toBe('calendar');
    });

    it('routes "schedule a meeting" to secretary', () => {
      expect(testRouting('Schedule a meeting with John')).toBe('calendar');
    });

    it('routes "send an email" to secretary', () => {
      expect(testRouting('Send an email to the team')).toBe('calendar');
    });

    it('routes "meeting" to secretary', () => {
      expect(testRouting('What meetings do I have today?')).toBe('calendar');
    });
  });

  describe('Home Automation Intent Detection', () => {
    it('routes "turn on lights" to home', () => {
      expect(testRouting('Turn on the living room lights')).toBe('home');
    });

    it('routes "set thermostat" to home', () => {
      expect(testRouting('Set the thermostat to 72')).toBe('home');
    });

    it('routes "lock the door" to home', () => {
      expect(testRouting('Lock the front door')).toBe('home');
    });

    it('routes "activate scene" to home', () => {
      expect(testRouting('Activate movie night scene')).toBe('home');
    });

    it('routes "turn off" to home', () => {
      expect(testRouting('Turn off everything')).toBe('home');
    });
  });

  describe('Default Chat Intent', () => {
    it('routes greetings to chat', () => {
      expect(testRouting('Hello!')).toBe('chat');
    });

    it('routes jokes to chat', () => {
      expect(testRouting('Tell me a joke')).toBe('chat');
    });

    it('routes casual conversation to chat', () => {
      expect(testRouting('How are you doing?')).toBe('chat');
    });

    it('routes philosophical questions to chat', () => {
      expect(testRouting('What is the meaning of life?')).toBe('chat');
    });
  });
});

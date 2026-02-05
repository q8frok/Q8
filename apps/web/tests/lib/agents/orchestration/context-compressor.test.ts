/**
 * Context Compressor Tests
 * Tests for intelligent conversation context compression
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI before importing
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"facts": ["test fact 1", "test fact 2"]}' } }],
        }),
      },
    },
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  ContextCompressor,
  needsCompression,
  type Message,
  type CompressedContext,
} from '@/lib/agents/orchestration/context-compressor';

describe('Context Compressor', () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    compressor = new ContextCompressor();
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      // 4 characters per token
      const text = 'Hello'; // 5 chars = 2 tokens (rounded up)
      expect(compressor.estimateTokens(text)).toBe(2);
    });

    it('should round up token count', () => {
      const text = 'Hi'; // 2 chars = 1 token
      expect(compressor.estimateTokens(text)).toBe(1);
    });

    it('should handle empty string', () => {
      expect(compressor.estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(400); // 400 chars = 100 tokens
      expect(compressor.estimateTokens(text)).toBe(100);
    });
  });

  describe('estimateMessagesTokens', () => {
    it('should sum token estimates for all messages plus role overhead', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }, // 2 tokens + 4 role = 6
        { role: 'assistant', content: 'Hi there' }, // 2 tokens + 4 role = 6
      ];

      // Total: 6 + 6 = 12
      expect(compressor.estimateMessagesTokens(messages)).toBe(12);
    });

    it('should handle empty messages array', () => {
      expect(compressor.estimateMessagesTokens([])).toBe(0);
    });

    it('should handle messages with different content lengths', () => {
      const messages: Message[] = [
        { role: 'user', content: '' }, // 0 + 4 = 4
        { role: 'assistant', content: 'a'.repeat(100) }, // 25 + 4 = 29
      ];

      expect(compressor.estimateMessagesTokens(messages)).toBe(33);
    });
  });

  describe('calculateImportance', () => {
    it('should have base importance of 0.5', () => {
      const message: Message = { role: 'assistant', content: 'Simple text.' };
      const importance = compressor.calculateImportance(message);
      expect(importance).toBeGreaterThanOrEqual(0.5);
    });

    it('should increase importance for questions', () => {
      const question: Message = { role: 'assistant', content: 'What do you think?' };
      const statement: Message = { role: 'assistant', content: 'I think this is good.' };

      expect(compressor.calculateImportance(question)).toBeGreaterThan(
        compressor.calculateImportance(statement)
      );
    });

    it('should increase importance for decision/action keywords', () => {
      const withDecision: Message = { role: 'assistant', content: 'We decided to use React.' };
      const withoutDecision: Message = { role: 'assistant', content: 'React is a library.' };

      expect(compressor.calculateImportance(withDecision)).toBeGreaterThan(
        compressor.calculateImportance(withoutDecision)
      );
    });

    it('should increase importance for personal information', () => {
      const personal: Message = { role: 'user', content: 'My name is John and I work at Google.' };
      const impersonal: Message = { role: 'user', content: 'The weather is nice today.' };

      expect(compressor.calculateImportance(personal)).toBeGreaterThan(
        compressor.calculateImportance(impersonal)
      );
    });

    it('should increase importance for code/technical content', () => {
      const withCode: Message = {
        role: 'assistant',
        content: '```javascript\nfunction test() {}\n```',
      };
      // Avoid "function", "class", "const", "let", "var", "import" which trigger code detection
      const withoutCode: Message = { role: 'assistant', content: 'Use a method for this task.' };

      expect(compressor.calculateImportance(withCode)).toBeGreaterThan(
        compressor.calculateImportance(withoutCode)
      );
    });

    it('should increase importance for user messages', () => {
      const userMessage: Message = { role: 'user', content: 'Test content here.' };
      const assistantMessage: Message = { role: 'assistant', content: 'Test content here.' };

      expect(compressor.calculateImportance(userMessage)).toBeGreaterThan(
        compressor.calculateImportance(assistantMessage)
      );
    });

    it('should cap importance at 1.0', () => {
      // Message with many importance factors
      const veryImportant: Message = {
        role: 'user',
        content:
          'My name is John? I decided I must remember this important function() for my favorite project.',
      };

      expect(compressor.calculateImportance(veryImportant)).toBeLessThanOrEqual(1.0);
    });
  });

  describe('buildContextString', () => {
    it('should build context with summary only', () => {
      const compressed: CompressedContext = {
        summary: 'This is a summary of the conversation.',
        keyFacts: [],
        recentMessages: [],
        totalOriginalTokens: 1000,
        totalCompressedTokens: 200,
        compressionRatio: 0.2,
      };

      const result = compressor.buildContextString(compressed);

      expect(result).toContain('Conversation Summary');
      expect(result).toContain('This is a summary of the conversation.');
      expect(result).not.toContain('Key Facts');
    });

    it('should build context with key facts only', () => {
      const compressed: CompressedContext = {
        summary: '',
        keyFacts: ['User prefers dark mode', 'User is a developer'],
        recentMessages: [],
        totalOriginalTokens: 1000,
        totalCompressedTokens: 200,
        compressionRatio: 0.2,
      };

      const result = compressor.buildContextString(compressed);

      expect(result).toContain('Key Facts');
      expect(result).toContain('User prefers dark mode');
      expect(result).toContain('User is a developer');
      expect(result).not.toContain('Conversation Summary');
    });

    it('should build context with both summary and key facts', () => {
      const compressed: CompressedContext = {
        summary: 'Summary text here.',
        keyFacts: ['Fact 1', 'Fact 2'],
        recentMessages: [],
        totalOriginalTokens: 1000,
        totalCompressedTokens: 200,
        compressionRatio: 0.2,
      };

      const result = compressor.buildContextString(compressed);

      expect(result).toContain('Conversation Summary');
      expect(result).toContain('Summary text here.');
      expect(result).toContain('Key Facts');
      expect(result).toContain('- Fact 1');
      expect(result).toContain('- Fact 2');
    });

    it('should return empty string when no summary or facts', () => {
      const compressed: CompressedContext = {
        summary: '',
        keyFacts: [],
        recentMessages: [],
        totalOriginalTokens: 100,
        totalCompressedTokens: 100,
        compressionRatio: 1.0,
      };

      const result = compressor.buildContextString(compressed);
      expect(result).toBe('');
    });
  });

  describe('compress (no LLM needed cases)', () => {
    it('should not compress when under token limit', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const result = await compressor.compress(messages);

      expect(result.recentMessages).toHaveLength(2);
      expect(result.summary).toBe('');
      expect(result.keyFacts).toHaveLength(0);
      expect(result.compressionRatio).toBe(1.0);
    });

    it('should preserve all messages when under limit', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
      ];

      const result = await compressor.compress(messages);

      expect(result.recentMessages).toEqual(messages);
      expect(result.totalOriginalTokens).toBe(result.totalCompressedTokens);
    });
  });

  describe('needsCompression utility', () => {
    it('should return false for short conversations', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      expect(needsCompression(messages)).toBe(false);
    });

    it('should return true for long conversations', () => {
      const messages: Message[] = Array.from({ length: 100 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'This is a fairly long message with multiple words. '.repeat(10),
      }));

      expect(needsCompression(messages)).toBe(true);
    });

    it('should respect custom maxTokens parameter', () => {
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(100) }, // ~25 tokens + 4
        { role: 'assistant', content: 'a'.repeat(100) }, // ~25 tokens + 4
      ];

      // Total ~58 tokens
      expect(needsCompression(messages, 50)).toBe(true);
      expect(needsCompression(messages, 100)).toBe(false);
    });
  });

  describe('custom configuration', () => {
    it('should accept custom maxTokens', () => {
      const customCompressor = new ContextCompressor({ maxTokens: 2000 });
      // Config is private but we can test behavior through compress
      expect(customCompressor).toBeInstanceOf(ContextCompressor);
    });

    it('should accept custom recentMessageCount', () => {
      const customCompressor = new ContextCompressor({ recentMessageCount: 10 });
      expect(customCompressor).toBeInstanceOf(ContextCompressor);
    });

    it('should accept custom importanceThreshold', () => {
      const customCompressor = new ContextCompressor({ importanceThreshold: 0.9 });
      expect(customCompressor).toBeInstanceOf(ContextCompressor);
    });
  });

  describe('fallback summarization', () => {
    it('should generate basic summary without LLM', async () => {
      // Create compressor without OpenAI key to trigger fallback
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const noLLMCompressor = new ContextCompressor({ maxTokens: 50 });

      const messages: Message[] = [
        { role: 'user', content: 'First user message. More details here.' },
        { role: 'assistant', content: 'First assistant response. Additional info.' },
        { role: 'user', content: 'Second user message. Even more.' },
        { role: 'assistant', content: 'Second assistant response. Final thoughts.' },
        { role: 'user', content: 'Third user message.' },
        { role: 'assistant', content: 'Third response.' },
        { role: 'user', content: 'Fourth message.' },
        { role: 'assistant', content: 'Fourth response.' },
      ];

      const result = await noLLMCompressor.compress(messages);

      // Should have a summary from fallback
      expect(result.summary).toContain('Previous conversation summary');
      expect(result.summary).toContain('User:');

      // Restore
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  describe('message importance scoring', () => {
    it('should score messages with "should" higher', () => {
      const message: Message = { role: 'assistant', content: 'You should use TypeScript.' };
      const importance = compressor.calculateImportance(message);
      expect(importance).toBeGreaterThan(0.5);
    });

    it('should score messages with "remember" higher', () => {
      const message: Message = { role: 'user', content: 'Remember this for later.' };
      const importance = compressor.calculateImportance(message);
      expect(importance).toBeGreaterThan(0.5);
    });

    it('should score messages with import/const higher (code indicators)', () => {
      const message: Message = { role: 'assistant', content: 'Use const x = 1 and import React.' };
      const importance = compressor.calculateImportance(message);
      expect(importance).toBeGreaterThan(0.5);
    });

    it('should handle system role same as assistant', () => {
      const system: Message = { role: 'system', content: 'Test content here.' };
      const assistant: Message = { role: 'assistant', content: 'Test content here.' };

      expect(compressor.calculateImportance(system)).toBe(
        compressor.calculateImportance(assistant)
      );
    });
  });
});

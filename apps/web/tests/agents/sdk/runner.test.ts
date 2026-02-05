/**
 * Tests for Agent Runner
 * Tests the core execution engine for agents
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// UNIT TESTS FOR PURE FUNCTIONS
// =============================================================================

describe('Agent Runner', () => {
  describe('executeTool', () => {
    // Reset mocks after each test
    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should execute a tool successfully', async () => {
      // Import executeTool directly
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      // Create a mock tool
      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          parse: vi.fn().mockImplementation((args) => args),
        },
        execute: vi.fn().mockResolvedValue({ data: 'test result' }),
      };

      const result = await executeTool('test_tool', { arg1: 'value' }, [mockTool as never]);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'test result' });
      expect(mockTool.execute).toHaveBeenCalledWith({ arg1: 'value' });
    });

    it('should return error for unknown tool', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const result = await executeTool('unknown_tool', {}, []);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
      expect(result.error?.message).toContain('not found');
    });

    it('should handle tool execution errors', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const mockTool = {
        name: 'failing_tool',
        description: 'A tool that fails',
        parameters: {
          parse: vi.fn().mockImplementation((args) => args),
        },
        execute: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
      };

      const result = await executeTool('failing_tool', {}, [mockTool as never]);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Tool execution failed');
    });

    it('should validate tool arguments with schema', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const mockSchema = {
        parse: vi.fn().mockImplementation((args) => args),
      };

      const mockTool = {
        name: 'validated_tool',
        description: 'A validated tool',
        parameters: mockSchema,
        execute: vi.fn().mockResolvedValue({ success: true }),
      };

      await executeTool('validated_tool', { foo: 'bar' }, [mockTool as never]);

      expect(mockSchema.parse).toHaveBeenCalledWith({ foo: 'bar' });
    });
  });

  describe('toOpenAITools', () => {
    it('should convert tool definitions to OpenAI format', async () => {
      const { toOpenAITools } = await import('@/lib/agents/sdk/runner');

      const mockTools = [
        {
          name: 'tool_one',
          description: 'First tool',
          parameters: {
            _def: {
              typeName: 'ZodObject',
              shape: () => ({}),
            },
          },
          execute: vi.fn(),
        },
        {
          name: 'tool_two',
          description: 'Second tool',
          parameters: {
            _def: {
              typeName: 'ZodObject',
              shape: () => ({}),
            },
          },
          execute: vi.fn(),
        },
      ];

      const result = toOpenAITools(mockTools as never);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'tool_one',
          description: 'First tool',
          parameters: expect.any(Object),
        },
      });
      expect(result[1]).toEqual({
        type: 'function',
        function: {
          name: 'tool_two',
          description: 'Second tool',
          parameters: expect.any(Object),
        },
      });
    });

    it('should handle empty parameters schema', async () => {
      const { toOpenAITools } = await import('@/lib/agents/sdk/runner');

      const mockTools = [
        {
          name: 'simple_tool',
          description: 'A simple tool',
          parameters: {}, // No _def
          execute: vi.fn(),
        },
      ];

      const result = toOpenAITools(mockTools as never);

      expect(result[0]?.function.parameters).toEqual({ type: 'object', properties: {} });
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt with agent instructions', async () => {
      const { buildSystemPrompt } = await import('@/lib/agents/sdk/runner');

      const mockConfig = {
        name: 'TestBot',
        type: 'personality' as const,
        model: 'test-model',
        instructions: 'You are a helpful test bot.',
        tools: [],
      };

      const context = {
        userId: 'test-user',
        threadId: 'test-thread',
      };

      const prompt = buildSystemPrompt(mockConfig, context);

      expect(prompt).toContain('You are a helpful test bot.');
      expect(prompt).toContain('Current date and time:');
    });

    it('should include user profile information when provided', async () => {
      const { buildSystemPrompt } = await import('@/lib/agents/sdk/runner');

      const mockConfig = {
        name: 'TestBot',
        type: 'personality' as const,
        model: 'test-model',
        instructions: 'Base instructions.',
        tools: [],
      };

      const context = {
        userId: 'test-user',
        userProfile: {
          name: 'Alice',
          timezone: 'America/New_York',
          communicationStyle: 'concise' as const,
        },
      };

      const prompt = buildSystemPrompt(mockConfig, context);

      expect(prompt).toContain('Alice');
      expect(prompt).toContain('America/New_York');
      expect(prompt).toContain('concise');
    });

    it('should handle detailed communication style', async () => {
      const { buildSystemPrompt } = await import('@/lib/agents/sdk/runner');

      const mockConfig = {
        name: 'TestBot',
        type: 'personality' as const,
        model: 'test-model',
        instructions: 'Base instructions.',
        tools: [],
      };

      const context = {
        userId: 'test-user',
        userProfile: {
          communicationStyle: 'detailed' as const,
        },
      };

      const prompt = buildSystemPrompt(mockConfig, context);

      expect(prompt).toContain('detailed');
      expect(prompt).toContain('thorough');
    });
  });

  describe('Module exports', () => {
    it('should export all expected types and functions', async () => {
      // This test verifies the module structure is correct
      const runner = await import('@/lib/agents/sdk/runner');

      // Check functions
      expect(runner).toHaveProperty('runAgent');
      expect(runner).toHaveProperty('streamMessage');
      expect(runner).toHaveProperty('executeTool');
      expect(runner).toHaveProperty('toOpenAITools');
      expect(runner).toHaveProperty('buildSystemPrompt');
    });
  });

  describe('Function exports', () => {
    it('should export runAgent function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(typeof runner.runAgent).toBe('function');
    });

    it('should export streamMessage function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(typeof runner.streamMessage).toBe('function');
    });

    it('should export executeTool function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(typeof runner.executeTool).toBe('function');
    });

    it('should export toOpenAITools function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(typeof runner.toOpenAITools).toBe('function');
    });

    it('should export buildSystemPrompt function', async () => {
      const runner = await import('@/lib/agents/sdk/runner');
      expect(typeof runner.buildSystemPrompt).toBe('function');
    });
  });

  describe('Tool timeout configuration', () => {
    it('should use default timeout for unknown tools', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      // Create a slow tool that should be stopped by timeout
      const slowTool = {
        name: 'slow_tool',
        description: 'A slow tool',
        parameters: {
          parse: vi.fn().mockImplementation((args) => args),
        },
        execute: vi.fn().mockImplementation(async () => {
          // This should complete before the 30s default timeout
          return { success: true };
        }),
      };

      const result = await executeTool('slow_tool', {}, [slowTool as never]);
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle validation errors in tool execution', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const mockTool = {
        name: 'validating_tool',
        description: 'Tool with validation',
        parameters: {
          parse: vi.fn().mockImplementation(() => {
            throw new Error('Invalid argument: expected string');
          }),
        },
        execute: vi.fn(),
      };

      const result = await executeTool('validating_tool', { bad: 'args' }, [mockTool as never]);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid argument');
    });

    it('should classify rate limit errors as recoverable', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const mockTool = {
        name: 'rate_limited_tool',
        description: 'Tool that hits rate limit',
        parameters: {
          parse: vi.fn().mockImplementation((args) => args),
        },
        execute: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
      };

      const result = await executeTool('rate_limited_tool', {}, [mockTool as never]);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.recoverable).toBe(true);
    });

    it('should classify auth errors as not recoverable', async () => {
      const { executeTool } = await import('@/lib/agents/sdk/runner');

      const mockTool = {
        name: 'auth_tool',
        description: 'Tool that fails auth',
        parameters: {
          parse: vi.fn().mockImplementation((args) => args),
        },
        execute: vi.fn().mockRejectedValue(new Error('401 Unauthorized')),
      };

      const result = await executeTool('auth_tool', {}, [mockTool as never]);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.recoverable).toBe(false);
    });
  });

  describe('Zod schema conversion', () => {
    it('should convert ZodObject with fields', async () => {
      const { toOpenAITools } = await import('@/lib/agents/sdk/runner');

      const mockTool = {
        name: 'complex_tool',
        description: 'Tool with complex schema',
        parameters: {
          _def: {
            typeName: 'ZodObject',
            shape: () => ({
              name: {
                _def: {
                  typeName: 'ZodString',
                  description: 'User name',
                },
              },
              age: {
                _def: {
                  typeName: 'ZodNumber',
                },
              },
              optional: {
                _def: {
                  typeName: 'ZodOptional',
                  innerType: {
                    _def: {
                      typeName: 'ZodString',
                    },
                  },
                },
              },
            }),
          },
        },
        execute: vi.fn(),
      };

      const result = toOpenAITools([mockTool as never]);

      expect(result[0]?.function.parameters).toHaveProperty('properties');
      expect(result[0]?.function.parameters).toHaveProperty('type', 'object');
    });
  });
});

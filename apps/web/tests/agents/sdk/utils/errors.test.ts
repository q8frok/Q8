import { describe, it, expect } from 'vitest';
import {
  classifyError,
  getUserFriendlyError,
  getRecoverySuggestion,
  createToolError,
} from '@/lib/agents/sdk/utils/errors';

describe('classifyError', () => {
  it('classifies timeout errors', () => {
    const result = classifyError(new Error('Request timed out'));
    expect(result.code).toBe('TIMEOUT');
    expect(result.recoverable).toBe(true);
  });

  it('classifies auth errors', () => {
    const result = classifyError(new Error('401 Unauthorized'));
    expect(result.code).toBe('AUTH_ERROR');
    expect(result.recoverable).toBe(false);
  });

  it('classifies rate limit errors', () => {
    const result = classifyError(new Error('429 Too Many Requests'));
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.recoverable).toBe(true);
  });

  it('classifies connection errors', () => {
    const result = classifyError(new Error('ECONNREFUSED'));
    expect(result.code).toBe('CONNECTION_ERROR');
    expect(result.recoverable).toBe(true);
  });

  it('classifies not found errors', () => {
    const result = classifyError(new Error('404 Not Found'));
    expect(result.code).toBe('NOT_FOUND');
    expect(result.recoverable).toBe(false);
  });
});

describe('getUserFriendlyError', () => {
  it('returns friendly message for spotify tools', () => {
    const message = getUserFriendlyError('spotify_play', 'Connection refused');
    expect(message).toContain('Spotify');
    expect(message).not.toContain('Connection refused');
  });

  it('returns friendly message for github tools', () => {
    const message = getUserFriendlyError('github_get_pr', 'API error');
    expect(message).toContain('GitHub');
  });

  it('returns generic message for unknown tools', () => {
    const message = getUserFriendlyError('unknown_tool', 'Some error');
    expect(message).toContain('unknown tool');
  });
});

describe('getRecoverySuggestion', () => {
  it('suggests re-auth for 401 errors', () => {
    const suggestion = getRecoverySuggestion('any_tool', '401 Unauthorized');
    expect(suggestion.toLowerCase()).toContain('authenticat');
  });

  it('suggests waiting for rate limits', () => {
    const suggestion = getRecoverySuggestion('any_tool', '429 rate limit');
    expect(suggestion.toLowerCase()).toContain('wait');
  });

  it('suggests checking connection for timeout', () => {
    const suggestion = getRecoverySuggestion('any_tool', 'Request timed out');
    expect(suggestion.toLowerCase()).toContain('connection');
  });
});

describe('createToolError', () => {
  it('creates structured error result', () => {
    const result = createToolError('spotify_play', new Error('Connection refused'));
    expect(result.success).toBe(false);
    expect(result.message).toContain('Spotify');
    expect(result.error.code).toBe('CONNECTION_ERROR');
    expect(result.error.recoverable).toBe(true);
    expect(result.error.suggestion).toBeDefined();
  });
});

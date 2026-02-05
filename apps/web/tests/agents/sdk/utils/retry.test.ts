import { describe, it, expect, vi } from 'vitest';
import { executeWithRetry, isTransientError } from '@/lib/agents/sdk/utils/retry';

describe('isTransientError', () => {
  it('returns true for timeout errors', () => {
    expect(isTransientError(new Error('Request timed out'))).toBe(true);
  });

  it('returns true for 429 rate limit errors', () => {
    expect(isTransientError(new Error('Error 429: Too many requests'))).toBe(true);
  });

  it('returns false for 404 errors', () => {
    expect(isTransientError(new Error('Error 404: Not found'))).toBe(false);
  });

  it('returns false for auth errors', () => {
    expect(isTransientError(new Error('Error 401: Unauthorized'))).toBe(false);
  });
});

describe('executeWithRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await executeWithRetry(fn, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const result = await executeWithRetry(fn, { maxRetries: 3, backoffMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));

    await expect(executeWithRetry(fn, { maxRetries: 2, backoffMs: 10 }))
      .rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-transient error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

    await expect(executeWithRetry(fn, { maxRetries: 3 }))
      .rejects.toThrow('401 Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

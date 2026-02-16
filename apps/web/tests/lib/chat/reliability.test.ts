import { describe, expect, it } from 'vitest';
import { CHAT_RELIABILITY, computeReconnectDelayMs } from '@/lib/chat/reliability';

describe('chat reliability', () => {
  it('computes exponential backoff and caps max delay', () => {
    expect(computeReconnectDelayMs(1)).toBe(CHAT_RELIABILITY.initialReconnectDelayMs);
    expect(computeReconnectDelayMs(2)).toBe(CHAT_RELIABILITY.initialReconnectDelayMs * 2);
    expect(computeReconnectDelayMs(20)).toBeLessThanOrEqual(CHAT_RELIABILITY.maxReconnectDelayMs);
  });
});

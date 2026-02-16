import { describe, expect, it } from 'vitest';
import { splitSSEBuffer, readSSEDataLine } from '@/lib/chat/transport/sse';

describe('sse helpers', () => {
  it('splits frames and returns remainder', () => {
    const { frames, rest } = splitSSEBuffer('data: {"a":1}\n\ndata: {"b":2}');
    expect(frames).toEqual(['data: {"a":1}']);
    expect(rest).toEqual('data: {"b":2}');
  });

  it('extracts data line only', () => {
    expect(readSSEDataLine('data: {"x":1}')).toBe('{"x":1}');
    expect(readSSEDataLine('event: ping')).toBeNull();
  });
});

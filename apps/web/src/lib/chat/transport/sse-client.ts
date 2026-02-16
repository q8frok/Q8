import { splitSSEBuffer, readSSEDataLine } from './sse';
import type { StreamTransport } from './types';

export const sseTransport: StreamTransport = {
  async streamJson({ url, init, signal, onMessage }) {
    const response = await fetch(url, {
      ...(init || {}),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = splitSSEBuffer(buffer);
      buffer = rest;

      for (const frame of frames) {
        const dataLine = readSSEDataLine(frame);
        if (!dataLine) continue;
        await onMessage(JSON.parse(dataLine));
      }
    }
  },
};

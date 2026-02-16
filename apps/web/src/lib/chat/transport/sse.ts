export function splitSSEBuffer(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() || '';
  return { frames: parts, rest };
}

export function readSSEDataLine(frame: string): string | null {
  if (!frame.startsWith('data: ')) return null;
  return frame.slice(6);
}

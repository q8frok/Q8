export const CHAT_RELIABILITY = {
  maxReconnectAttempts: 6,
  heartbeatIntervalMs: 15_000,
  initialReconnectDelayMs: 2_000,
  maxReconnectDelayMs: 30_000,
} as const;

export function computeReconnectDelayMs(attempt: number): number {
  return Math.min(
    CHAT_RELIABILITY.initialReconnectDelayMs * (2 ** Math.max(attempt - 1, 0)),
    CHAT_RELIABILITY.maxReconnectDelayMs
  );
}

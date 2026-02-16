export type ChatReliabilityConfig = {
  maxReconnectAttempts: number;
  heartbeatIntervalMs: number;
  initialReconnectDelayMs: number;
  maxReconnectDelayMs: number;
};

export const CHAT_RELIABILITY: ChatReliabilityConfig = {
  maxReconnectAttempts: 6,
  heartbeatIntervalMs: 15_000,
  initialReconnectDelayMs: 2_000,
  maxReconnectDelayMs: 30_000,
};

export function computeReconnectDelayMs(attempt: number, config: ChatReliabilityConfig = CHAT_RELIABILITY): number {
  return Math.min(
    config.initialReconnectDelayMs * (2 ** Math.max(attempt - 1, 0)),
    config.maxReconnectDelayMs
  );
}

export const CHAT_RELIABILITY_STORAGE_KEY = 'q8.chat.reliability';

export type ChatReliabilityOverrides = Partial<{
  maxReconnectAttempts: number;
  heartbeatIntervalMs: number;
  initialReconnectDelayMs: number;
  maxReconnectDelayMs: number;
}>;

export function getChatReliability(): ChatReliabilityConfig {
  if (typeof window === 'undefined') return CHAT_RELIABILITY;
  try {
    const raw = localStorage.getItem(CHAT_RELIABILITY_STORAGE_KEY);
    if (!raw) return CHAT_RELIABILITY;
    const parsed = JSON.parse(raw) as ChatReliabilityOverrides;
    return { ...CHAT_RELIABILITY, ...parsed };
  } catch {
    return CHAT_RELIABILITY;
  }
}

export function setChatReliability(overrides: ChatReliabilityOverrides): ChatReliabilityConfig {
  const next = { ...CHAT_RELIABILITY, ...overrides };
  if (typeof window !== 'undefined') {
    localStorage.setItem(CHAT_RELIABILITY_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

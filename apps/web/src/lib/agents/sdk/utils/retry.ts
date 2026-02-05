/**
 * Retry utilities with exponential backoff
 * Handles transient failures gracefully
 */

/**
 * Check if an error is transient (worth retrying)
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket hang up') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('too many requests')
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  retryOn?: (error: Error) => boolean;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    maxBackoffMs = 30000,
    retryOn = isTransientError,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-transient errors
      if (!retryOn(lastError)) {
        throw lastError;
      }

      // Don't sleep after last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          backoffMs * Math.pow(2, attempt) + Math.random() * 100,
          maxBackoffMs
        );
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

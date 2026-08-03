/**
 * Retry policy — exponential backoff with full jitter.
 * Pure, dependency-free, unit-testable.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default 3). */
  attempts?: number;
  /** Base delay in ms for the first retry (default 500). */
  baseDelayMs?: number;
  /** Max delay in ms (default 8_000). */
  maxDelayMs?: number;
  /** Multiplier between attempts (default 2). */
  factor?: number;
  /** Retry on failure even for non-transient errors (default false). */
  retryOnNonTransient?: boolean;
  /** Optional predicate to decide retryability of an error. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message;
  return (
    /timeout|timed ?out|econnreset|econnrefused|eai_again|socket hang up|5\d\d|429|rate limit|overloaded|temporarily|busy/i.test(
      message
    )
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Full jitter between 0 and min(maxDelay, base * factor^attempt). */
export function backoffDelay(attempt: number, options: Required<Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "factor">>): number {
  const cap = Math.min(options.maxDelayMs, options.baseDelayMs * Math.pow(options.factor, attempt - 1));
  return Math.floor(Math.random() * Math.max(cap, 1));
}

const DEFAULT_RETRY: Required<Pick<RetryOptions, "attempts" | "baseDelayMs" | "maxDelayMs" | "factor" | "retryOnNonTransient">> = {
  attempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  factor: 2,
  retryOnNonTransient: false,
};

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const config = { ...DEFAULT_RETRY, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= config.attempts) break;

      const transient = isTransientError(err);
      const retryable = options.shouldRetry
        ? options.shouldRetry(err, attempt)
        : transient || config.retryOnNonTransient;

      if (!retryable) break;

      await delay(backoffDelay(attempt, config));
    }
  }

  throw lastError;
}

/** Attach a cancellation signal to a promise. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = "Operation timed out"): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${message} after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

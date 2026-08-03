/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-instance deployments (Vercel serverless functions are
 * per-isolate; for multi-instance scale, swap for a shared store such as
 * Upstash Redis via the same interface).
 */

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms when the window resets
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  startedAt: number;
}

export class MemoryRateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, now: number = Date.now()): RateLimitResult {
    const window = this.windows.get(key);
    const resetAt = window ? window.startedAt + this.windowMs : now + this.windowMs;

    if (!window || window.startedAt + this.windowMs <= now) {
      this.windows.set(key, { count: 1, startedAt: now });
      return {
        ok: true,
        limit: this.limit,
        remaining: this.limit - 1,
        resetAt: now + this.windowMs,
        retryAfterSeconds: 0,
      };
    }

    if (window.count >= this.limit) {
      return {
        ok: false,
        limit: this.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(0, Math.ceil((resetAt - now) / 1000)),
      };
    }

    window.count += 1;
    return {
      ok: true,
      limit: this.limit,
      remaining: this.limit - window.count,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  /** Prevent unbounded memory growth. */
  prune(now: number = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.startedAt + this.windowMs <= now) {
        this.windows.delete(key);
      }
    }
  }

  get size(): number {
    return this.windows.size;
  }
}

/** Default limiter for AI endpoints. */
export const aiRateLimiter = new MemoryRateLimiter(10, 60_000);

/** Default limiter for email endpoints. */
export const emailRateLimiter = new MemoryRateLimiter(20, 60_000);

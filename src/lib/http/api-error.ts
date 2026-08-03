/**
 * Typed API error — carries an HTTP status and optional public message.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(status: number, message: string, publicMessage?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.publicMessage = publicMessage ?? message;
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError(404, message);
  }

  static rateLimited(message = "Too many requests", retryAfterSeconds = 60): ApiError {
    const err = new ApiError(429, message);
    (err as ApiError & { retryAfterSeconds?: number }).retryAfterSeconds = retryAfterSeconds;
    return err;
  }

  static serviceUnavailable(message = "Service unavailable"): ApiError {
    return new ApiError(503, message);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** True when the error is a known third-party auth/config failure (503-able). */
export function isConfigurationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /api.?key|not set|401|403|configuration|environment/i.test(err.message);
}

/**
 * Minimal structured logger.
 * - Pretty-prints in development, emits JSON lines in production.
 * - Serializes errors (message, name, stack, code) safely.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function serializeError(err: unknown): Record<string, unknown> | unknown {
  if (!(err instanceof Error)) return err;
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message,
  };
  if (err.stack) out.stack = err.stack;
  const code = (err as Error & { code?: unknown }).code;
  if (code !== undefined) out.code = code;
  const status = (err as Error & { status?: unknown }).status;
  if (status !== undefined) out.status = status;
  return out;
}

function redact(value: unknown, key: string): unknown {
  if (typeof value !== "string") return value;
  if (/key|secret|token|password|authorization|apikey/i.test(key)) {
    return value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : "••••";
  }
  return value;
}

function scrub(obj: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = redact(value, key);
  }
  return out;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function write(level: LogLevel, message: string, context?: LogContext, err?: unknown): void {
  const now = new Date().toISOString();
  const entry = { level, ts: now, msg: message };

  if (err) {
    (entry as Record<string, unknown>).error = serializeError(err);
  }
  if (context && Object.keys(context).length > 0) {
    Object.assign(entry, scrub(context));
  }

  const minLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  if (isProd()) {
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  } else {
    const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(scrub(context))}` : "";
    const errSuffix = err ? ` ${err instanceof Error ? err.message : String(err)}` : "";
    console[level === "debug" ? "log" : level](`[${now}] ${level.toUpperCase()} ${message}${ctx}${errSuffix}`);
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext, err?: unknown): void {
    write("warn", message, context, err);
  },
  error(message: string, context?: LogContext, err?: unknown): void {
    write("error", message, context, err);
  },
};

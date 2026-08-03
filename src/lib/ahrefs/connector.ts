/**
 * Ahrefs API connector — Sprint 6.
 *
 * Reads real backlink data (API v4) with an injectable fetcher for tests:
 * target resolution (domain), paginated `backlinks/backlinks`, retries with
 * backoff on 429/5xx. Pure — never touches storage.
 */

export const AHREFS_API_BASE = "https://api.ahrefs.com/v4";

export interface AhrefsBacklink {
  urlFrom: string;
  urlTo: string;
  domainFrom: string;
  domainRating: number;
  anchor: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface AhrefsPage {
  rows: AhrefsBacklink[];
  total: number;
  nextCursor: string | null;
}

export interface AhrefsClient {
  /** Fetch one page of backlinks for `target`, optionally continuing from `cursor`. */
  fetchBacklinks(target: string, cursor?: string, limit?: number): Promise<AhrefsPage>;
}

export interface AhrefsConnectorOptions {
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
  apiToken?: string;
  /** Delay between API calls to respect quotas (ms). */
  minIntervalMs?: number;
  /** Max retries on 429/5xx. */
  maxRetries?: number;
}

export class AhrefsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AhrefsApiError";
  }
}

export function backoffMs(attempt: number, baseMs = 500, maxMs = 8000): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

export function createAhrefsClient(options: AhrefsConnectorOptions = {}): AhrefsClient {
  const apiToken = options.apiToken ?? process.env.AHREFS_API_TOKEN ?? "";
  const fetcher = options.fetcher ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const minIntervalMs = options.minIntervalMs ?? 0;
  const maxRetries = options.maxRetries ?? 3;
  let lastCallAt = 0;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function call(target: string, cursor?: string, limit = 1000): Promise<AhrefsPage> {
    const params = new URLSearchParams({
      target,
      mode: "domain",
      limit: String(limit),
      select: "urlFrom,urlTo,domainFrom,domainRating,anchor,firstSeen,lastSeen",
    });
    if (cursor) params.set("cursor", cursor);
    const url = `${AHREFS_API_BASE}/backlinks/backlinks?${params.toString()}`;

    let lastError: AhrefsApiError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffMs(attempt - 1));

      const wait = lastCallAt + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastCallAt = Date.now();

      let res: Response;
      try {
        res = await fetcher(url, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
      } catch (err) {
        lastError = new AhrefsApiError(0, `Network error: ${String(err)}`);
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        lastError = new AhrefsApiError(res.status, `Ahrefs API ${res.status}`);
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new AhrefsApiError(res.status, `Ahrefs API ${res.status}: ${detail.slice(0, 200)}`);
      }

      const payload = (await res.json()) as {
        total?: number;
        backlinks?: Array<{
          urlFrom?: string;
          urlTo?: string;
          domainFrom?: string;
          domainRating?: number;
          anchor?: string | null;
          firstSeen?: string | null;
          lastSeen?: string | null;
        }>;
        pagination?: { next?: string };
      };

      return {
        rows: (payload.backlinks ?? []).map((b) => ({
          urlFrom: b.urlFrom ?? "",
          urlTo: b.urlTo ?? target,
          domainFrom: b.domainFrom ?? "",
          domainRating: b.domainRating ?? 0,
          anchor: b.anchor ?? null,
          firstSeen: b.firstSeen ?? null,
          lastSeen: b.lastSeen ?? null,
        })),
        total: payload.total ?? 0,
        nextCursor: payload.pagination?.next ?? null,
      };
    }

    throw lastError ?? new AhrefsApiError(0, "Ahrefs request failed");
  }

  return {
    async fetchBacklinks(target, cursor, limit) {
      return call(target, cursor, limit);
    },
  };
}

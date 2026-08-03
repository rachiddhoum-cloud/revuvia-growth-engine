/**
 * Google Search Console connector — Sprint 5, Phase 2.
 *
 * Reusable client with dependency injection (a `fetcher` is injected so
 * tests never touch the network). Capabilities:
 *   - search queries, pages, countries, devices, search types, daily metrics
 *   - custom date ranges, pagination (startRow), retries, rate limiting
 *   - automatic access-token refresh (pure, injectable token endpoint)
 */

export const GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";
export const GSC_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export type GscDimension = "query" | "page" | "country" | "device" | "date" | "searchType";

export interface GscRow {
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  position: number; // 1-based avg position
  keys: string[];
}

export interface GscRequest {
  siteUrl: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  dimensions?: GscDimension[];
  searchType?: "web" | "image" | "video" | "news" | "discover";
  rowLimit?: number; // max 1000 (API cap)
  startRow?: number; // pagination offset
}

export interface GscClient {
  /** Search Analytics rows for the given request (paginated handled by caller). */
  searchAnalytics(req: GscRequest): Promise<GscRow[]>;
  /** Lists sites the account can access. */
  listSites(): Promise<{ siteUrl: string }[]>;
}

export interface Fetcher {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface GscCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
  siteUrl: string;
}

export interface ConnectorOptions {
  fetcher?: Fetcher;
  retries?: number;
  /** Minimum ms between API calls (rate limiting). */
  minIntervalMs?: number;
}

/** Exponential backoff delay in ms for a retry index. */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 8000): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Wrap a raw GSC token (access token, no refresh). */
export class GscApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GscApiError";
  }
}

/**
 * Build a GSC client. `fetcher` defaults to global fetch but can be injected
 * in tests. Retries with exponential backoff on 429/5xx, and enforces a
 * minimum interval between calls (simple client-side rate limiting).
 */
export function createGscClient(
  credentials: GscCredentials,
  options: ConnectorOptions = {}
): GscClient {
  const {
    fetcher = (url: string, init?: RequestInit) => fetch(url, init),
    retries = 3,
    minIntervalMs = 150,
  } = options;

  let lastCallAt = 0;

  const call = async (path: string, init: RequestInit): Promise<Response> => {
    const wait = lastCallAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetcher(`${GSC_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });

      if (res.ok) return res;
      if (isRetryable(res.status) && attempt < retries) {
        lastError = new GscApiError(res.status, `GSC API ${res.status}, retrying`);
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new GscApiError(res.status, `GSC API error ${res.status}: ${await res.text()}`);
    }
    throw lastError ?? new GscApiError(500, "GSC API failed");
  };

  return {
    async searchAnalytics(req: GscRequest): Promise<GscRow[]> {
      const body: Record<string, unknown> = {
        startDate: req.startDate,
        endDate: req.endDate,
        dimensions: req.dimensions ?? ["query"],
        rowLimit: req.rowLimit ?? 1000,
      };
      if (req.searchType) body.searchType = req.searchType;
      if (req.startRow !== undefined && req.startRow > 0) body.startRow = req.startRow;

      const res = await call(
        `/sites/${encodeURIComponent(req.siteUrl)}/searchAnalytics/query`,
        { method: "POST", body: JSON.stringify(body) }
      );
      const payload = (await res.json()) as { rows?: GscRow[] | null };
      return payload.rows ?? [];
    },

    async listSites(): Promise<{ siteUrl: string }[]> {
      const res = await call("/sites", { method: "GET" });
      const payload = (await res.json()) as { siteEntry?: { siteUrl: string }[] | null };
      return (payload.siteEntry ?? []).map((e) => ({ siteUrl: e.siteUrl }));
    },
  };
}

export interface RefreshResult {
  accessToken: string;
  expiresAt: string; // ISO (now + expires_in seconds - margin)
}

export interface TokenResult extends RefreshResult {
  refreshToken: string;
}

/**
 * Exchange an authorization code for access + refresh tokens (OAuth callback).
 * Injectable fetcher for tests; never stores anything.
 */
export async function exchangeAuthorizationCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetcher: Fetcher = (url: string, init?: RequestInit) => fetch(url, init)
): Promise<TokenResult> {
  const res = await fetcher(GSC_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    throw new GscApiError(res.status, `Authorization code exchange failed: ${res.status}`);
  }
  const payload = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new GscApiError(400, "Authorization code exchange returned incomplete tokens");
  }
  const margin = 60; // refresh 60s before expiry
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000 - margin * 1000).toISOString(),
  };
}

/**
 * Exchange a refresh token for a new access token. Injectable fetcher for
 * tests; returns the new token + expiry, never stores anything.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  fetcher: Fetcher = (url: string, init?: RequestInit) => fetch(url, init)
): Promise<RefreshResult> {
  const res = await fetcher(GSC_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    throw new GscApiError(res.status, `Token refresh failed: ${res.status}`);
  }
  const payload = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token || !payload.expires_in) {
    throw new GscApiError(400, "Token refresh returned no access token");
  }
  const margin = 60; // refresh 60s before expiry
  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000 - margin * 1000).toISOString(),
  };
}

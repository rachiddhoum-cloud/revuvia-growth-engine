import { describe, expect, it, vi } from "vitest";

import {
  backoffMs,
  createGscClient,
  exchangeAuthorizationCode,
  GscApiError,
  refreshAccessToken,
} from "@/lib/gsc/connector";
import type { Fetcher } from "@/lib/gsc/connector";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

const creds = {
  accessToken: "tok",
  refreshToken: "rt",
  expiresAt: "2099-01-01T00:00:00.000Z",
  siteUrl: "sc-domain:example.com",
};

describe("backoffMs", () => {
  it("grows exponentially and caps", () => {
    expect(backoffMs(0)).toBe(500);
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(10)).toBe(8000);
  });
});

describe("createGscClient.searchAnalytics", () => {
  it("maps rows and uses bearer auth", async () => {
    const fetcher: Fetcher = vi.fn(async (url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer tok");
      expect(url).toContain("/sites/sc-domain%3Aexample.com/searchAnalytics/query");
      return jsonResponse({
        rows: [
          { clicks: 3, impressions: 100, ctr: 0.03, position: 5, keys: ["qr code menu"] },
        ],
      });
    });

    const client = createGscClient(creds, { fetcher, minIntervalMs: 0 });
    const rows = await client.searchAnalytics({ siteUrl: creds.siteUrl, startDate: "2026-08-01", endDate: "2026-08-07" });
    expect(rows).toEqual([
      { clicks: 3, impressions: 100, ctr: 0.03, position: 5, keys: ["qr code menu"] },
    ]);
  });

  it("passes dimensions, searchType and pagination offsets", async () => {
    const fetcher: Fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.dimensions).toEqual(["page", "device"]);
      expect(body.searchType).toBe("web");
      expect(body.startRow).toBe(1000);
      return jsonResponse({ rows: [] });
    });
    const client = createGscClient(creds, { fetcher, minIntervalMs: 0 });
    await client.searchAnalytics({
      siteUrl: creds.siteUrl,
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      dimensions: ["page", "device"],
      searchType: "web",
      startRow: 1000,
    });
  });

  it("returns empty rows when payload has none", async () => {
    const fetcher: Fetcher = async () => jsonResponse({});
    const client = createGscClient(creds, { fetcher, minIntervalMs: 0 });
    expect(await client.searchAnalytics({ siteUrl: "s", startDate: "d", endDate: "d" })).toEqual([]);
  });

  it("retries on 429 then succeeds", async () => {
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls++;
      if (calls === 1) return jsonResponse({ error: "quota" }, 429);
      return jsonResponse({ rows: [{ clicks: 1, impressions: 10, ctr: 0.1, position: 3, keys: ["k"] }] });
    };
    const client = createGscClient(creds, { fetcher, retries: 3, minIntervalMs: 0 });
    const rows = await client.searchAnalytics({ siteUrl: "s", startDate: "d", endDate: "d" });
    expect(rows.length).toBe(1);
    expect(calls).toBe(2);
  });

  it("throws after exhausting retries on 500", async () => {
    const fetcher: Fetcher = async () => jsonResponse({}, 500);
    const client = createGscClient(creds, { fetcher, retries: 2, minIntervalMs: 0 });
    await expect(
      client.searchAnalytics({ siteUrl: "s", startDate: "d", endDate: "d" })
    ).rejects.toBeInstanceOf(GscApiError);
  });

  it("does not retry on 4xx non-rate-limit errors", async () => {
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls++;
      return jsonResponse({ error: "bad request" }, 400);
    };
    const client = createGscClient(creds, { fetcher, retries: 3, minIntervalMs: 0 });
    await expect(
      client.searchAnalytics({ siteUrl: "s", startDate: "d", endDate: "d" })
    ).rejects.toBeInstanceOf(GscApiError);
    expect(calls).toBe(1);
  });
});

describe("createGscClient.listSites", () => {
  it("maps site entries", async () => {
    const fetcher: Fetcher = async () =>
      jsonResponse({ siteEntry: [{ siteUrl: "sc-domain:a.com" }, { siteUrl: "b.com" }] });
    const client = createGscClient(creds, { fetcher, minIntervalMs: 0 });
    expect(await client.listSites()).toEqual([{ siteUrl: "sc-domain:a.com" }, { siteUrl: "b.com" }]);
  });
});

describe("refreshAccessToken", () => {
  it("returns the new token with a safety margin on expiry", async () => {
    const fetcher: Fetcher = vi.fn(async (url, init) => {
      expect(url).toContain("oauth2.googleapis.com/token");
      expect(String(init?.body)).toContain("grant_type=refresh_token");
      expect(String(init?.body)).toContain("client_secret=secret");
      return jsonResponse({ access_token: "new-tok", expires_in: 3600 });
    });
    const result = await refreshAccessToken("rt", "cid", "secret", fetcher);
    expect(result.accessToken).toBe("new-tok");
    const remaining = (new Date(result.expiresAt).getTime() - Date.now()) / 1000;
    expect(remaining).toBeGreaterThan(3500);
    expect(remaining).toBeLessThanOrEqual(3600);
  });

  it("throws when the endpoint rejects", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ error: "invalid_grant" }, 400);
    await expect(refreshAccessToken("rt", "cid", "secret", fetcher)).rejects.toBeInstanceOf(GscApiError);
  });

  it("throws when no access token is returned", async () => {
    const fetcher: Fetcher = async () => jsonResponse({});
    await expect(refreshAccessToken("rt", "cid", "secret", fetcher)).rejects.toBeInstanceOf(GscApiError);
  });
});

describe("exchangeAuthorizationCode", () => {
  it("exchanges a code for access + refresh tokens", async () => {
    const fetcher: Fetcher = vi.fn(async (url, init) => {
      expect(url).toContain("oauth2.googleapis.com/token");
      const body = String(init?.body);
      expect(body).toContain("grant_type=authorization_code");
      expect(body).toContain("code=auth-code");
      expect(body).toContain("redirect_uri=https%3A%2F%2Fapp.example.com%2Fapi%2Fgsc%2Fcallback");
      return jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600 });
    });
    const result = await exchangeAuthorizationCode(
      "auth-code",
      "cid",
      "secret",
      "https://app.example.com/api/gsc/callback",
      fetcher
    );
    expect(result.accessToken).toBe("at");
    expect(result.refreshToken).toBe("rt");
  });

  it("throws when the endpoint rejects", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ error: "invalid_client" }, 401);
    await expect(
      exchangeAuthorizationCode("code", "cid", "secret", "https://app.example.com/cb", fetcher)
    ).rejects.toBeInstanceOf(GscApiError);
  });
});

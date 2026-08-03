import { describe, expect, it, vi } from "vitest";

import { createAhrefsClient } from "@/lib/ahrefs/connector";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

describe("createAhrefsClient.fetchBacklinks", () => {
  it("maps the v4 response into normalized rows", async () => {
    const fetcher = vi.fn(async (url, init) => {
      expect(String(url)).toContain("api.ahrefs.com/v4/backlinks/backlinks");
      expect(String(url)).toContain("target=example.com");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer tok" });
      return jsonResponse({
        total: 2,
        backlinks: [
          {
            urlFrom: "https://ref.com/a",
            urlTo: "https://example.com/",
            domainFrom: "ref.com",
            domainRating: 42,
            anchor: "click here",
            firstSeen: "2026-01-01",
            lastSeen: "2026-07-01",
          },
          { urlFrom: "https://ref2.com/b", urlTo: "https://example.com/", domainFrom: "ref2.com" },
        ],
        pagination: { next: "cursor-2" },
      });
    });

    const client = createAhrefsClient({ fetcher, apiToken: "tok", minIntervalMs: 0 });
    const page = await client.fetchBacklinks("example.com");

    expect(page.total).toBe(2);
    expect(page.nextCursor).toBe("cursor-2");
    expect(page.rows[0]).toMatchObject({
      urlFrom: "https://ref.com/a",
      domainFrom: "ref.com",
      domainRating: 42,
      anchor: "click here",
    });
    expect(page.rows[1].domainRating).toBe(0);
  });

  it("passes the cursor to paginate", async () => {
    const fetcher = vi.fn(async (url) => {
      expect(String(url)).toContain("cursor=next-1");
      return jsonResponse({ backlinks: [], total: 0 });
    });
    const client = createAhrefsClient({ fetcher, apiToken: "tok", minIntervalMs: 0 });
    await client.fetchBacklinks("example.com", "next-1");
  });

  it("retries on 429 with backoff then succeeds", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      if (calls < 3) return jsonResponse({}, 429);
      return jsonResponse({ backlinks: [{ urlFrom: "a", urlTo: "b" }], total: 1 });
    };
    const client = createAhrefsClient({ fetcher, apiToken: "tok", minIntervalMs: 0, maxRetries: 3 });
    const page = await client.fetchBacklinks("example.com");
    expect(page.rows).toHaveLength(1);
    expect(calls).toBe(3);
  });

  it("throws after exhausting retries", async () => {
    const fetcher = async () => jsonResponse({}, 500);
    const client = createAhrefsClient({ fetcher, apiToken: "tok", minIntervalMs: 0, maxRetries: 1 });
    await expect(client.fetchBacklinks("example.com")).rejects.toThrow();
  });
});

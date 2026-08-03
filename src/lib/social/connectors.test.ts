import { describe, expect, it, vi } from "vitest";

import {
  publishFacebook,
  publishLinkedIn,
  publishToPlatform,
  publishX,
  SocialApiError,
  type Fetcher,
} from "@/lib/social/connectors";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

const linkedinCred = { platform: "linkedin" as const, access_token: "li-tok", account_id: "urn:li:person:abc", account_name: "Me" };
const facebookCred = { platform: "facebook" as const, access_token: "fb-tok", account_id: "page-123", account_name: "Page" };
const xCred = { platform: "x" as const, access_token: "x-tok", account_id: null, account_name: null };

describe("publishLinkedIn", () => {
  it("POSTs a UGC post with Bearer auth and returns the share URL", async () => {
    const fetcher: Fetcher = vi.fn(async (url, init) => {
      expect(url).toContain("api.linkedin.com/v2/ugcPosts");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer li-tok" });
      const body = JSON.parse(String(init?.body));
      expect(body.author).toBe("urn:li:person:abc");
      expect(body.lifecycleState).toBe("PUBLISHED");
      return jsonResponse({ id: "urn:li:share:123456" });
    });
    const result = await publishLinkedIn(linkedinCred, "Hello", fetcher);
    expect(result.ok).toBe(true);
    expect(result.platformPostId).toBe("123456");
    expect(result.externalUrl).toContain("linkedin.com/feed/update");
  });

  it("throws SocialApiError on API failure", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ message: "nope" }, 403);
    await expect(publishLinkedIn(linkedinCred, "Hello", fetcher)).rejects.toBeInstanceOf(SocialApiError);
  });
});

describe("publishFacebook", () => {
  it("POSTs a link post to the page feed", async () => {
    const fetcher: Fetcher = vi.fn(async (url, init) => {
      expect(url).toContain("graph.facebook.com/v21.0/page-123/feed");
      expect(String(init?.body)).toContain("access_token=fb-tok");
      expect(String(init?.body)).toContain("link=https%3A%2F%2Fexample.com%2Fpost");
      return jsonResponse({ id: "page-123_987" });
    });
    const result = await publishFacebook(facebookCred, "Hello", "https://example.com/post", fetcher);
    expect(result.ok).toBe(true);
    expect(result.externalUrl).toContain("facebook.com/page-123/posts/987");
  });
});

describe("publishX", () => {
  it("POSTs a tweet capped at 280 characters", async () => {
    const fetcher: Fetcher = vi.fn(async (url, init) => {
      expect(url).toContain("api.x.com/2/tweets");
      const body = JSON.parse(String(init?.body));
      expect(body.text.length).toBeLessThanOrEqual(280);
      return jsonResponse({ data: { id: "tweet-1" } });
    });
    const result = await publishX(xCred, "a".repeat(400), fetcher);
    expect(result.ok).toBe(true);
    expect(result.externalUrl).toBe("https://x.com/i/status/tweet-1");
  });
});

describe("publishToPlatform", () => {
  it("routes to the correct platform connector", async () => {
    const fetcher: Fetcher = async () => jsonResponse({ data: { id: "t-1" } });
    const result = await publishToPlatform(xCred, "tweet", null, fetcher);
    expect(result.platformPostId).toBe("t-1");
  });
});

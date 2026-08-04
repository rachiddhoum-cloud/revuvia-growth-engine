import { afterEach, describe, expect, it, vi } from "vitest";

import { blogPostUrl, getRevuviaSiteUrl } from "@/lib/publishing/site-config";

describe("site-config", () => {
  afterEach(() => {
    delete process.env.REVUVIA_SITE_URL;
  });

  it("defaults to revuvia.com", () => {
    expect(getRevuviaSiteUrl()).toBe("https://revuvia.com");
    expect(blogPostUrl("avis-google-restaurant")).toBe(
      "https://revuvia.com/blog/avis-google-restaurant"
    );
  });

  it("respects REVUVIA_SITE_URL without trailing slash", () => {
    process.env.REVUVIA_SITE_URL = "https://revuvia.com/";
    expect(getRevuviaSiteUrl()).toBe("https://revuvia.com");
    expect(blogPostUrl("seo-local")).toBe("https://revuvia.com/blog/seo-local");
  });
});

describe("pushArticleToMarketingSite", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BLOG_PUBLISH_WEBHOOK_URL;
    delete process.env.BLOG_PUBLISH_WEBHOOK_SECRET;
  });

  it("skips when webhook URL is unset", async () => {
    const { pushArticleToMarketingSite } = await import("@/lib/publishing/site-bridge");
    const result = await pushArticleToMarketingSite({
      id: "a1",
      slug: "test-post",
      title: "Test",
    });
    expect(result.webhookAttempted).toBe(false);
    expect(result.canonicalUrl).toBe("https://revuvia.com/blog/test-post");
  });

  it("POSTs payload when webhook URL is set", async () => {
    process.env.BLOG_PUBLISH_WEBHOOK_URL = "https://revuvia.com/api/blog/sync";
    process.env.BLOG_PUBLISH_WEBHOOK_SECRET = "super-secret-token-32chars";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { pushArticleToMarketingSite } = await import("@/lib/publishing/site-bridge");
    const result = await pushArticleToMarketingSite({
      id: "a1",
      slug: "qr-menu",
      title: "QR Menu Guide",
      body_markdown: "# Hello",
      excerpt: "Hook",
    });

    expect(result.webhookAttempted).toBe(true);
    expect(result.webhookOk).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("https://revuvia.com/api/blog/sync");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer super-secret-token-32chars",
    });
    const body = JSON.parse(String(init.body));
    expect(body.action).toBe("publish");
    expect(body.article.slug).toBe("qr-menu");
    expect(body.canonicalUrl).toBe("https://revuvia.com/blog/qr-menu");
  });
});

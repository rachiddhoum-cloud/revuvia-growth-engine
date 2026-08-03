import { describe, expect, it } from "vitest";

import {
  buildInternalLinkPlan,
  extractAnchor,
  jaccard,
  suggestArticleLinks,
  suggestCanonicalLinks,
  tokenize,
} from "@/lib/linking";

const ARTICLE_BODY = `# How to get more Google reviews for your restaurant

Using QR codes on your table is the fastest way to collect reviews. Learn the
pricing options on our pricing page and explore the features of the platform.
Customers love a simple link they can scan right after their meal.`;

describe("tokenize", () => {
  it("removes stopwords and short tokens", () => {
    const tokens = tokenize("How to get more Google reviews for your restaurant");
    expect(tokens).toContain("restaurant");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("to");
  });
});

describe("jaccard", () => {
  it("returns 1 for identical sets and 0 for disjoint sets", () => {
    expect(jaccard(["a", "b"], ["b", "a"])).toBe(1);
    expect(jaccard(["a"], ["b"])).toBe(0);
    expect(jaccard([], ["a"])).toBe(0);
  });
});

describe("extractAnchor", () => {
  it("returns a short sentence containing the phrase", () => {
    const anchor = extractAnchor(ARTICLE_BODY, "QR codes");
    expect(anchor.toLowerCase()).toContain("qr");
    expect(anchor.length).toBeLessThanOrEqual(60);
  });

  it("falls back to the phrase when not found", () => {
    expect(extractAnchor(ARTICLE_BODY, "zzz")).toBe("zzz");
  });
});

describe("suggestCanonicalLinks", () => {
  it("suggests the pricing page when the body mentions pricing", () => {
    const links = suggestCanonicalLinks({ title: "Google reviews guide", bodyMarkdown: ARTICLE_BODY });
    const pricing = links.find((l) => l.targetType === "pricing");
    expect(pricing).toBeDefined();
    expect(pricing?.targetUrl).toContain("/pricing");
  });

  it("prepends appUrl when provided", () => {
    const links = suggestCanonicalLinks({
      title: "guide",
      bodyMarkdown: ARTICLE_BODY,
      appUrl: "https://app.example.com",
    });
    for (const link of links) {
      expect(link.targetUrl.startsWith("https://app.example.com")).toBe(true);
    }
  });
});

describe("suggestArticleLinks", () => {
  it("ranks related articles above unrelated ones", () => {
    const articles = [
      { id: "1", title: "The best QR code strategies for restaurants", slug: "qr-strategies" },
      { id: "2", title: "How to bake sourdough bread at home", slug: "sourdough" },
    ];
    const links = suggestArticleLinks(
      { title: "Get more Google reviews with QR codes", bodyMarkdown: ARTICLE_BODY, primaryKeyword: "qr codes" },
      articles
    );
    expect(links.length).toBeGreaterThan(0);
    const best = links[0];
    expect(best.targetUrl).toContain("qr-strategies");
    expect(best.score).toBeGreaterThanOrEqual(links[links.length - 1]?.score ?? 0);
  });

  it("returns empty when nothing is related", () => {
    const links = suggestArticleLinks(
      { title: "Sourdough baking", bodyMarkdown: "How to bake bread with starter." },
      [{ id: "1", title: "QR code marketing", slug: "qr" }]
    );
    expect(links).toHaveLength(0);
  });
});

describe("buildInternalLinkPlan", () => {
  it("combines canonical and article links, ranked, capped at 8", () => {
    const articles = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `Guide to Google review collection ${i}`,
      slug: `review-guide-${i}`,
      tags: ["seo"],
    }));
    const plan = buildInternalLinkPlan({
      title: "Collect more Google reviews",
      bodyMarkdown: ARTICLE_BODY,
      primaryKeyword: "google reviews",
      tags: ["seo"],
      publishedArticles: articles,
    });
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i - 1].score).toBeGreaterThanOrEqual(plan[i].score);
    }
  });
});

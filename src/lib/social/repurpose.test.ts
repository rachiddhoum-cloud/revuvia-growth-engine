import { describe, expect, it } from "vitest";

import {
  REPURPOSE_PLATFORMS,
  buildHashtags,
  extractHook,
  extractStat,
  extractTakeaways,
  paragraphize,
  repurposeArticle,
  repurposeToPosts,
  stripMarkdown,
} from "@/lib/social/repurpose";
import type { RepurposeArticle } from "@/lib/social/repurpose";

const article: RepurposeArticle = {
  title: "How QR Codes Boost Restaurant Reviews",
  excerpt: "A practical guide to turning QR menus into five-star review machines.",
  bodyMarkdown: `# How QR Codes Boost Restaurant Reviews

Restaurants that switch to QR menus see 2.3x more Google reviews in the first month.
The reason is simple: less friction means more customers actually leave feedback.

## Key takeaways
- Place the QR code on every table and the receipt.
- Ask at the peak moment — right after the meal.
- Make the form take under 30 seconds to complete.

Customers love it because it feels modern and effortless. Start today.`,
  tags: ["QR codes", "reviews", "restaurants"],
  cta: { label: "Get the checklist", href: "/checklist", tone: "primary", position: "bottom" },
  url: "https://revuvia.app/blog/qr-codes-reviews",
};

describe("stripMarkdown", () => {
  it("removes headings, links, bold and code fences", () => {
    const result = stripMarkdown("# Title\n\nSome **bold** and [link](https://x.com) here");
    expect(result).not.toContain("Title");
    expect(result).toContain("bold");
    expect(result).not.toContain("**");
    expect(result).not.toContain("https://x.com");
  });

  it("collapses whitespace", () => {
    expect(stripMarkdown("a\n\n\n   b")).toBe("a b");
  });
});

describe("extractHook", () => {
  it("returns the first sentence", () => {
    expect(extractHook(article.bodyMarkdown)).toContain("2.3x");
  });
});

describe("extractStat", () => {
  it("finds the sentence containing a statistic", () => {
    const stat = extractStat(article.bodyMarkdown);
    expect(stat).toContain("2.3x");
  });

  it("returns null when no statistic exists", () => {
    expect(extractStat("Just a normal sentence without numbers.")).toBeNull();
  });
});

describe("extractTakeaways", () => {
  it("returns up to max short sentences", () => {
    const takeaways = extractTakeaways(article.bodyMarkdown, 3);
    expect(takeaways.length).toBeGreaterThan(0);
    expect(takeaways.length).toBeLessThanOrEqual(3);
  });
});

describe("paragraphize", () => {
  it("chunks sentences into paragraphs under maxLength", () => {
    const paragraphs = paragraphize(stripMarkdown(article.bodyMarkdown), 100);
    for (const p of paragraphs) expect(p.length).toBeLessThanOrEqual(120);
    expect(paragraphs.length).toBeGreaterThan(1);
  });
});

describe("buildHashtags", () => {
  it("converts tags to hashtags, dedupes and caps count", () => {
    const hashtags = buildHashtags(article, ["reviews"], 3);
    expect(hashtags).toContain("#qrcodes");
    expect(hashtags).toContain("#reviews");
    expect(hashtags.length).toBeLessThanOrEqual(3);
  });

  it("strips non-alphanumeric characters", () => {
    expect(buildHashtags({ tags: ["C#", "a.b"] }, [], 5)).toEqual(["#c", "#ab"]);
  });
});

describe("repurposeArticle", () => {
  it("generates a post for every requested platform", () => {
    const posts = repurposeArticle(article, { platforms: ["linkedin", "x", "facebook", "instagram", "whatsapp", "email"] });
    expect(posts.map((p) => p.platform).sort()).toEqual(REPURPOSE_PLATFORMS.slice().sort());
  });

  it("respects the x 280 char limit", () => {
    const posts = repurposeArticle(article, { platforms: ["x"] });
    expect(posts[0].body.length).toBeLessThanOrEqual(280);
  });

  it("respects the whatsapp 600 char limit", () => {
    const posts = repurposeArticle(article, { platforms: ["whatsapp"] });
    expect(posts[0].body.length).toBeLessThanOrEqual(600);
  });

  it("embeds the CTA link when url is provided", () => {
    const posts = repurposeArticle(article, { platforms: ["x"] });
    expect(posts[0].body).toContain("https://revuvia.app/blog/qr-codes-reviews");
  });

  it("dedupes identical platform requests", () => {
    const posts = repurposeArticle(article, { platforms: ["x", "x", "linkedin", "linkedin"] });
    expect(posts.map((p) => p.platform)).toEqual(["x", "linkedin"]);
  });

  it("returns empty when no supported platform is requested", () => {
    expect(repurposeArticle(article, { platforms: ["video"] })).toEqual([]);
  });
});

describe("repurposeToPosts", () => {
  it("defaults to all platforms via options wrapper", () => {
    const posts = repurposeToPosts(article, REPURPOSE_PLATFORMS);
    expect(posts.length).toBe(REPURPOSE_PLATFORMS.length);
  });
});

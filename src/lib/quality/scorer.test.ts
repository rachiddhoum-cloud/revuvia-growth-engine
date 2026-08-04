import { describe, expect, it } from "vitest";

import {
  QUALITY_PASS_THRESHOLD,
  QUALITY_WEIGHTS,
  scoreCtaQuality,
  scoreContent,
  scoreKeywordDensity,
  scoreMetaQuality,
  scoreOriginality,
  scoreReadability,
  scoreSeoQuality,
  scoreStructure,
  scoreTitleQuality,
} from "@/lib/quality";

const GOOD_ARTICLE = `# How to get more Google reviews for your restaurant

## Why reviews matter for local SEO

Google reviews are the single strongest trust signal for local businesses.
Restaurants with more reviews rank higher in local search and convert more
walk-in customers into repeat guests.

## The fastest way to collect reviews

A smart QR code on the table is the fastest way to collect reviews. When a
customer finishes their meal, they scan a QR code, and a pre-filled review
link opens on their phone.

### Ask at the right moment

Timing matters. Ask for a review right after a positive interaction, not at
checkout when the customer is in a hurry.

### Make it effortless

The fewer taps required, the more reviews you collect. A single tap that
opens a pre-filled review form dramatically increases completion rates.

## Common mistakes to avoid

- Asking for a review before service is complete
- Making the review link hard to find
- Ignoring negative feedback
- Offering incentives that violate Google policy

## How to respond to reviews

Always respond to reviews within 48 hours. Thank positive reviewers and
acknowledge negative feedback with a concrete resolution plan.

## FAQ

### Do I need to ask every customer?

No. Focus on customers who had a clearly positive experience.

### Can I automate review requests?

Yes. Tools like Revuvia automate review collection with smart links and
scheduled reminders.

## Conclusion

Collecting Google reviews is a compounding growth channel for any local
business. Start with a simple QR code strategy and scale from there.`;

const GOOD_INPUT = {
  title: "How to get more Google reviews for your restaurant",
  metaTitle: "Get More Google Reviews for Your Restaurant (2026 Guide)",
  metaDescription:
    "Learn how to get more Google reviews for your restaurant with QR codes, smart links, and automation. A step-by-step guide for local business owners.",
  bodyMarkdown: GOOD_ARTICLE,
  excerpt: "A practical guide to collecting more Google reviews.",
  featuredSnippet:
    "The fastest way to get more Google reviews is a smart QR code that opens a pre-filled review link at the right moment.",
  tags: ["seo", "google-reviews", "restaurants"],
  faqs: [
    { question: "Do I need to ask every customer?", answer: "No." },
    { question: "Can I automate review requests?", answer: "Yes." },
  ],
  internalLinks: [
    { text: "Pricing", url: "/pricing" },
    { text: "Features", url: "/features" },
  ],
  cta: { label: "Start collecting reviews", href: "/register", position: "bottom" },
  jsonLd: { Article: { "@type": "Article", headline: "Test" } },
  primaryKeyword: "google reviews",
};

describe("scoreContent", () => {
  it("passes a well-structured article at or above the pass threshold", () => {
    const result = scoreContent(GOOD_INPUT);
    expect(result.overall).toBeGreaterThanOrEqual(QUALITY_PASS_THRESHOLD);
    expect(result.passed).toBe(true);
    expect(result.dimensions.readability.score).toBeGreaterThan(50);
  });

  it("weights sum to ~1.0", () => {
    const total = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("returns all 9 dimensions", () => {
    const result = scoreContent(GOOD_INPUT);
    expect(Object.keys(result.dimensions)).toHaveLength(9);
    for (const d of Object.values(result.dimensions)) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("scoreReadability", () => {
  it("penalizes empty body", () => {
    expect(scoreReadability("").score).toBe(0);
  });

  it("scores short simple text higher than dense text", () => {
    const simple = scoreReadability("This is a short simple sentence. Another short one here.");
    const dense = scoreReadability(
      "Notwithstanding the aforementioned considerations, the aforementioned quantitative analysis comprehensively delineates the operational framework."
    );
    expect(simple.score).toBeGreaterThan(dense.score);
  });
});

describe("scoreStructure", () => {
  it("rewards H2/H3 hierarchy with lists and FAQs", () => {
    const result = scoreStructure(GOOD_ARTICLE, [{ q: "a", a: "b" }, { q: "c", a: "d" }]);
    expect(result.score).toBeGreaterThan(60);
  });

  it("penalizes flat content without headings", () => {
    const result = scoreStructure("Just a paragraph. " + "Words ".repeat(300), []);
    expect(result.score).toBeLessThan(50);
  });
});

describe("scoreTitleQuality", () => {
  it("rewards keyword presence and optimal length", () => {
    const result = scoreTitleQuality("How to get more Google reviews for your restaurant", GOOD_ARTICLE, "google reviews");
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("penalizes clickbait and missing keyword", () => {
    const result = scoreTitleQuality("You won't believe this secret!", GOOD_ARTICLE, "restaurant");
    expect(result.score).toBeLessThan(60);
  });
});

describe("scoreMetaQuality", () => {
  it("scores 120-160 char description well", () => {
    const desc = "d".repeat(140);
    const result = scoreMetaQuality("Meta Title".slice(0, 45), desc);
    expect(result.score).toBeGreaterThan(70);
  });

  it("penalizes missing meta", () => {
    expect(scoreMetaQuality("", "").score).toBeLessThan(30);
  });
});

describe("scoreKeywordDensity", () => {
  it("penalizes keyword stuffing", () => {
    const stuffed = ("google reviews ".repeat(20) + " content ".repeat(100)).trim();
    const result = scoreKeywordDensity(stuffed, "google reviews");
    expect(result.score).toBeLessThan(50);
  });

  it("penalizes missing keyword entirely", () => {
    const result = scoreKeywordDensity("nothing about the topic here ".repeat(60), "restaurant");
    expect(result.score).toBeLessThan(60);
  });
});

describe("scoreCtaQuality", () => {
  it("scores complete CTA well", () => {
    const result = scoreCtaQuality({ label: "Get started", href: "/register", position: "bottom" });
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("penalizes missing CTA", () => {
    const result = scoreCtaQuality(undefined);
    expect(result.score).toBeLessThan(30);
  });
});

describe("scoreOriginality", () => {
  it("rewards vocabulary diversity", () => {
    const varied = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    expect(scoreOriginality(varied).score).toBeGreaterThan(70);
  });

  it("penalizes heavy repetition", () => {
    expect(scoreOriginality("same same same same same same same same same same same same").score).toBeLessThan(40);
  });
});

describe("scoreSeoQuality", () => {
  it("rewards snippet, JSON-LD, tags and internal links", () => {
    const result = scoreSeoQuality({
      bodyMarkdown: GOOD_ARTICLE,
      featuredSnippet: "The fastest way to collect reviews is a QR code.",
      tags: ["seo", "reviews"],
      internalLinks: [{ url: "/pricing" }, { url: "/features" }],
      jsonLd: { Article: { "@type": "Article" } },
      keyword: "google reviews",
    });
    expect(result.score).toBeGreaterThan(60);
  });

  it("penalizes missing SEO elements", () => {
    const result = scoreSeoQuality({
      bodyMarkdown: "plain body",
      featuredSnippet: undefined,
      tags: [],
      internalLinks: [],
      jsonLd: undefined,
    });
    expect(result.score).toBeLessThan(50);
  });
});

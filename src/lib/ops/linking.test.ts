import { describe, expect, it } from "vitest";

import { analyzeInternalLinks, keywordTokens, sharedTokens } from "@/lib/ops/linking";
import type { ArticleRef } from "@/lib/ops/types";

const articles: ArticleRef[] = [
  { id: "1", title: "SEO pour restaurants à Marrakech" },
  { id: "2", title: "Avis Google pour restaurants" },
  { id: "3", title: "QR codes pour restaurants" },
  { id: "4", title: "Guide complet de la comptabilité" },
];

describe("keywordTokens", () => {
  it("splits titles into meaningful sorted keywords", () => {
    const tokens = keywordTokens("Avis Google pour restaurants");
    expect(tokens).toContain("avis");
    expect(tokens).toContain("google");
    expect(tokens).toContain("restaurants");
  });

  it("drops stopwords and short tokens", () => {
    const tokens = keywordTokens("Les et le pour des");
    expect(tokens).toEqual([]);
  });

  it("deduplicates tokens", () => {
    expect(keywordTokens("Avis Avis avis")).toEqual(["avis"]);
  });
});

describe("sharedTokens", () => {
  it("finds shared keywords between two articles", () => {
    const a = articles.map((x) => ({ ...x, tokens: keywordTokens(x.title) }));
    const shared = sharedTokens(a[0], a[1]);
    expect(shared).toContain("restaurants");
  });

  it("returns empty when nothing is shared", () => {
    const a = articles.map((x) => ({ ...x, tokens: keywordTokens(x.title) }));
    expect(sharedTokens(a[0], a[3])).toEqual([]);
  });
});

describe("analyzeInternalLinks", () => {
  it("suggests contextual links between keyword-related pages", () => {
    const plan = analyzeInternalLinks(articles);
    expect(plan.suggestions.length).toBeGreaterThan(0);
    const first = plan.suggestions[0];
    expect(first.anchor).toBeTruthy();
    expect(first.reason).toContain("Shares keyword");
  });

  it("detects orphan pages with no incoming links", () => {
    const plan = analyzeInternalLinks(articles);
    expect(plan.orphans.some((o) => o.id === "4")).toBe(true);
  });

  it("caps suggestions per page", () => {
    const plan = analyzeInternalLinks(articles, 1);
    const counts = new Map<string, number>();
    for (const s of plan.suggestions) {
      counts.set(s.sourceId, (counts.get(s.sourceId) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it("computes coverage percentage", () => {
    const plan = analyzeInternalLinks(articles);
    expect(plan.coveragePct).toBeGreaterThan(0);
    expect(plan.coveragePct).toBeLessThanOrEqual(100);
  });

  it("handles a single article (no suggestions, 1 orphan)", () => {
    const plan = analyzeInternalLinks([{ id: "1", title: "Solo article" }]);
    expect(plan.suggestions).toEqual([]);
    expect(plan.orphans.map((o) => o.id)).toEqual(["1"]);
    expect(plan.coveragePct).toBe(0);
  });

  it("is deterministic", () => {
    const a = analyzeInternalLinks(articles);
    const b = analyzeInternalLinks(articles);
    expect(a).toEqual(b);
  });
});

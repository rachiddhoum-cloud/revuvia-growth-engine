import { describe, expect, it } from "vitest";

import { anchorFromTitle, buildLinkingIntel, orphanPages, weakLinkPages, zeroAuthorityPages } from "@/lib/gsc/linking-intel";

const pages = [
  { url: "/blog/seo-marrakech", clicks: 120, impressions: 3000, incomingLinks: 0, title: "SEO pour restaurants à Marrakech" },
  { url: "/blog/avis-google", clicks: 80, impressions: 2000, incomingLinks: 2, title: "Avis Google pour restaurants" },
  { url: "/blog/qr-code", clicks: 10, impressions: 400, incomingLinks: 1, title: "QR codes pour restaurants" },
  { url: "/pricing", clicks: 40, impressions: 500, incomingLinks: 3, title: "Tarifs" },
];

describe("orphanPages", () => {
  it("returns pages with zero incoming links sorted by impressions", () => {
    expect(orphanPages(pages).map((p) => p.url)).toEqual(["/blog/seo-marrakech"]);
  });
});

describe("weakLinkPages", () => {
  it("returns pages getting clicks with fewer than min incoming links", () => {
    const weak = weakLinkPages(pages, 2);
    expect(weak.map((p) => p.url)).toContain("/blog/qr-code");
    expect(weak.map((p) => p.url)).not.toContain("/pricing");
  });
});

describe("anchorFromTitle", () => {
  it("derives a readable anchor from a title", () => {
    expect(anchorFromTitle("SEO pour restaurants à Marrakech")).toBe("seo pour restaurants marrakech");
    expect(anchorFromTitle("Tarifs")).toBe("tarifs");
  });
});

describe("zeroAuthorityPages", () => {
  it("finds pages with no internal links and no backlinks", () => {
    const withOrphan = [
      ...pages,
      { url: "/blog/new-page", clicks: 5, impressions: 300, incomingLinks: 0, title: "Nouveau" },
    ];
    const external = new Map([["/blog/seo-marrakech", { count: 3, maxDomainRating: 50 }]]);
    const result = zeroAuthorityPages(withOrphan, external);
    expect(result.map((p) => p.url)).toEqual(["/blog/new-page"]);
  });

  it("excludes pages that have backlinks", () => {
    const external = new Map([
      ["/blog/new-page", { count: 1, maxDomainRating: 20 }],
      ["/blog/seo-marrakech", { count: 2, maxDomainRating: 40 }],
    ]);
    expect(zeroAuthorityPages(
      [...pages, { url: "/blog/new-page", clicks: 5, impressions: 300, incomingLinks: 0, title: "Nouveau" }],
      external
    )).toEqual([]);
  });
});

describe("buildLinkingIntel", () => {
  it("ranks linking suggestions by ICE", () => {
    const items = buildLinkingIntel({ pages, acvUsd: 100 });
    expect(items.some((i) => i.kind === "orphan")).toBe(true);
    expect(items.some((i) => i.kind === "weak_link")).toBe(true);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].ice).toBeGreaterThanOrEqual(items[i].ice);
    }
    expect(items.every((i) => i.expectedTrafficGain > 0)).toBe(true);
  });
});

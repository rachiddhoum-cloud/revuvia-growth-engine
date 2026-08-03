import { describe, expect, it } from "vitest";

import {
  articleFeatures,
  articleStructurePatterns,
  channelPatterns,
  detectAllPatterns,
  keywordClusterPatterns,
  leadMagnetPatterns,
  outreachPatterns,
  publicationTimePatterns,
  weekdayName,
} from "@/lib/learning/patterns";
import type {
  ArticleSample,
  BacklinkSample,
  CtaSample,
  DailySample,
  KeywordSample,
  MagnetSample,
  OutreachSample,
  PostSample,
} from "@/lib/learning/types";

const articles: ArticleSample[] = [
  { slug: "a1", title: "10 SEO tips for 2026", kind: "article", ctaType: "cta_schedule", leadMagnetKind: null, publishedAt: "2026-06-01", traffic: 240, impressions: 8000, leads: 12 },
  { slug: "a2", title: "The complete guide to winning at local search engine optimization and rankings", kind: "article", ctaType: "cta_schedule", leadMagnetKind: null, publishedAt: "2026-06-02", traffic: 180, impressions: 6000, leads: 9 },
  { slug: "a3", title: "Local SEO guide for restaurants and cafes", kind: "article", ctaType: "cta_demo", leadMagnetKind: null, publishedAt: "2026-06-03", traffic: 60, impressions: 2500, leads: 2 },
  { slug: "a4", title: "Pricing for SaaS teams", kind: "landing", ctaType: "cta_demo", leadMagnetKind: null, publishedAt: "2026-06-04", traffic: 30, impressions: 1200, leads: 1 },
];

describe("articleFeatures", () => {
  it("extracts structure + content-type features from a title", () => {
    const feats = articleFeatures(articles[0]);
    const keys = feats.map((f) => `${f.strategyType}:${f.key}`);
    expect(keys).toContain("article_structure:title_has_number");
    expect(keys).toContain("content_type:article");
    const guide = articleFeatures(articles[1]).map((f) => `${f.strategyType}:${f.key}`);
    expect(guide).toContain("article_structure:title_how_to_or_guide");
  });
});

describe("articleStructurePatterns", () => {
  it("flags title_has_number as the winning structure", () => {
    const patterns = articleStructurePatterns(articles, 1);
    const numbers = patterns.find((p) => p.key === "title_has_number");
    expect(numbers).toBeDefined();
    expect(numbers?.upliftPct).toBeGreaterThan(0);
    const landing = patterns.find((p) => p.key === "landing");
    expect(landing?.upliftPct).toBeLessThan(0);
    expect(patterns.every((p) => p.samples >= 1)).toBe(true);
  });

  it("sorts by uplift desc and is deterministic", () => {
    const a = articleStructurePatterns(articles, 1);
    const b = articleStructurePatterns(articles, 1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const uplifts = a.map((p) => p.upliftPct);
    expect(uplifts).toEqual([...uplifts].sort((x, y) => y - x));
  });
});

describe("keywordClusterPatterns", () => {
  it("groups queries by leading token and ranks by clicks", () => {
    const keywords: KeywordSample[] = [
      { query: "seo audit tool", clicks: 50, impressions: 1000, ctr: 0.05, position: 4 },
      { query: "seo checklist", clicks: 40, impressions: 900, ctr: 0.04, position: 5 },
      { query: "pricing page tips", clicks: 5, impressions: 300, ctr: 0.02, position: 12 },
    ];
    const patterns = keywordClusterPatterns(keywords, 2);
    const seo = patterns.find((p) => p.key === "seo");
    expect(seo?.samples).toBe(2);
    expect(seo?.upliftPct).toBeGreaterThan(0);
  });
});

describe("publicationTimePatterns", () => {
  it("detects the best weekday from revenue", () => {
    const daily: DailySample[] = [
      { date: "2026-08-03", organicVisits: 100, clicks: 10, conversions: 1, leadDownloads: 2, revenue: 120 },
      { date: "2026-08-04", organicVisits: 90, clicks: 9, conversions: 0, leadDownloads: 1, revenue: 30 },
      { date: "2026-08-10", organicVisits: 110, clicks: 11, conversions: 1, leadDownloads: 2, revenue: 200 },
      { date: "2026-08-11", organicVisits: 80, clicks: 8, conversions: 0, leadDownloads: 0, revenue: 50 },
    ];
    const patterns = publicationTimePatterns(daily, [], 2);
    const monday = patterns.find((p) => p.key === "weekday:Monday");
    expect(monday).toBeDefined();
    expect(monday?.avgTraffic).toBe(160);
    expect(monday?.upliftPct).toBeGreaterThan(0);
  });

  it("derives hour patterns from social posts", () => {
    const posts: PostSample[] = [
      { platform: "linkedin", publishedAt: "2026-08-03T09:00:00Z", scheduledFor: null, published: true },
      { platform: "linkedin", publishedAt: "2026-08-04T09:00:00Z", scheduledFor: null, published: true },
      { platform: "x", publishedAt: "2026-08-03T18:00:00Z", scheduledFor: null, published: false },
    ];
    const patterns = publicationTimePatterns([], posts, 2);
    const hour9 = patterns.find((p) => p.key === "hour:09h");
    expect(hour9?.samples).toBe(2);
    expect(hour9?.successRate).toBe(1);
  });
});

describe("weekdayName", () => {
  it("maps ISO dates to weekday names", () => {
    expect(weekdayName("2026-08-03")).toBe("Monday");
    expect(weekdayName("bad-date")).toBe("?");
  });
});

describe("channelPatterns / outreachPatterns / leadMagnetPatterns", () => {
  it("ranks channels by published share", () => {
    const posts: PostSample[] = [
      { platform: "linkedin", publishedAt: "2026-08-03T09:00:00Z", scheduledFor: null, published: true },
      { platform: "linkedin", publishedAt: "2026-08-04T09:00:00Z", scheduledFor: null, published: true },
      { platform: "x", publishedAt: "2026-08-03T18:00:00Z", scheduledFor: null, published: false },
      { platform: "x", publishedAt: "2026-08-04T18:00:00Z", scheduledFor: null, published: false },
    ];
    const patterns = channelPatterns(posts, 2);
    const linkedin = patterns.find((p) => p.key === "linkedin");
    expect(linkedin?.successRate).toBe(1);
    expect(linkedin?.upliftPct).toBeGreaterThan(0);
  });

  it("prefers personalized outreach", () => {
    const tasks: OutreachSample[] = [
      { pageUrl: "/p1", personalized: true, status: "done", updatedAt: "2026-08-01" },
      { pageUrl: "/p2", personalized: true, status: "done", updatedAt: "2026-08-02" },
      { pageUrl: "/p3", personalized: false, status: "queued", updatedAt: null },
    ];
    const patterns = outreachPatterns(tasks, 2);
    expect(patterns.find((p) => p.key === "personalized")?.successRate).toBe(1);
    expect(patterns).toHaveLength(1);
  });

  it("ranks lead magnet kinds by downloads", () => {
    const magnets: MagnetSample[] = [
      { kind: "checklist", title: "SEO checklist", downloads: 80 },
      { kind: "checklist", title: "Launch checklist", downloads: 60 },
      { kind: "guide", title: "Growth guide", downloads: 10 },
    ];
    const patterns = leadMagnetPatterns(magnets, 2);
    expect(patterns.find((p) => p.key === "checklist")?.upliftPct).toBeGreaterThan(0);
  });
});

describe("detectAllPatterns", () => {
  it("combines all detectors and returns winners first", () => {
    const backlinks: BacklinkSample[] = [{ urlFrom: "https://x.com/a", domainFrom: "blog.example.com", domainRating: 45 }];
    const ctas: CtaSample[] = [{ ctaType: "cta_schedule", traffic: 200, leads: 10 }, { ctaType: "cta_schedule", traffic: 150, leads: 8 }];
    const all = detectAllPatterns({ articles, keywords: [], posts: [], daily: [], outreach: [], backlinks, magnets: [], ctas }, 2);
    expect(all.length).toBeGreaterThan(0);
    expect(all.find((p) => p.strategyType === "backlink_source")).toBeDefined();
    expect(all.find((p) => p.strategyType === "cta")).toBeDefined();
    const uplifts = all.map((p) => p.upliftPct);
    expect(uplifts).toEqual([...uplifts].sort((a, b) => b - a));
  });
});

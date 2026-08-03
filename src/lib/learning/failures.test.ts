import { describe, expect, it } from "vitest";

import {
  daysAgo,
  deadKeywords,
  detectAllFailures,
  lowRoiContent,
  neverRankingPages,
  staleOutreach,
} from "@/lib/learning/failures";
import type { ArticleSample, OutreachSample } from "@/lib/learning/types";
import type { PageTrendSample, QueryTrendSample } from "@/lib/learning/failures";

const asOf = "2026-08-03";

const articles: ArticleSample[] = [
  { slug: "fresh", title: "Fresh article", kind: "article", ctaType: null, leadMagnetKind: null, publishedAt: "2026-08-01", traffic: 12, impressions: 500, leads: 1 },
  { slug: "dead-30", title: "Dead 30 days", kind: "article", ctaType: null, leadMagnetKind: null, publishedAt: "2026-06-01", traffic: 0, impressions: 60, leads: 0 },
  { slug: "dead-20", title: "Dead 20 days", kind: "article", ctaType: null, leadMagnetKind: null, publishedAt: "2026-07-15", traffic: 0, impressions: 40, leads: 0 },
];

describe("daysAgo", () => {
  it("returns ISO dates n days before asOf", () => {
    expect(daysAgo("2026-08-03", 14)).toBe("2026-07-20");
    expect(daysAgo("2026-03-01", 1)).toBe("2026-02-28");
  });
});

describe("lowRoiContent", () => {
  it("flags old content with zero traffic and grades severity by age", () => {
    const failures = lowRoiContent(articles, asOf);
    const targets = failures.map((f) => f.target);
    expect(targets).toContain("/dead-30");
    expect(targets).toContain("/dead-20");
    expect(targets).not.toContain("/fresh");
    const old = failures.find((f) => f.target === "/dead-30");
    expect(old?.severity).toBe("high");
    expect(old?.correctiveAction).toContain("301");
    const recent = failures.find((f) => f.target === "/dead-20");
    expect(recent?.severity).toBe("medium");
  });
});

describe("deadKeywords", () => {
  const queries: QueryTrendSample[] = [
    { query: "seo audit", date: "2026-07-20", clicks: 8, impressions: 200 },
    { query: "seo audit", date: "2026-07-21", clicks: 6, impressions: 180 },
    { query: "seo audit", date: "2026-07-27", clicks: 0, impressions: 0 },
    { query: "seo audit", date: "2026-07-28", clicks: 0, impressions: 0 },
    { query: "healthy", date: "2026-07-20", clicks: 2, impressions: 100 },
    { query: "healthy", date: "2026-07-21", clicks: 3, impressions: 120 },
    { query: "healthy", date: "2026-07-27", clicks: 4, impressions: 140 },
    { query: "healthy", date: "2026-07-28", clicks: 5, impressions: 160 },
  ];

  it("detects collapsed queries and leaves stable ones alone", () => {
    const failures = deadKeywords(queries, asOf);
    expect(failures).toHaveLength(1);
    expect(failures[0].target).toBe("seo audit");
    expect(failures[0].severity).toBe("high");
    expect(failures[0].correctiveAction).toContain("Stop");
  });

  it("needs at least 4 observations", () => {
    expect(deadKeywords([queries[0], queries[1]], asOf)).toHaveLength(0);
  });
});

describe("neverRankingPages", () => {
  const pages: PageTrendSample[] = [
    { url: "/never", date: "2026-07-20", impressions: 300, position: 40 },
    { url: "/never", date: "2026-07-21", impressions: 350, position: 42 },
    { url: "/ranked", date: "2026-07-20", impressions: 500, position: 9 },
    { url: "/small", date: "2026-07-20", impressions: 50, position: 45 },
  ];

  it("flags impression-rich pages stuck below position 20", () => {
    const failures = neverRankingPages(pages, asOf);
    expect(failures.map((f) => f.target)).toEqual(["/never"]);
    expect(failures[0].severity).toBe("medium");
    expect(failures[0].correctiveAction).toContain("title");
  });
});

describe("staleOutreach", () => {
  const tasks: OutreachSample[] = [
    { pageUrl: "/p-stale", personalized: false, status: "in_progress", updatedAt: "2026-07-01" },
    { pageUrl: "/p-fresh", personalized: true, status: "in_progress", updatedAt: "2026-08-01" },
    { pageUrl: "/p-done-old", personalized: true, status: "done", updatedAt: "2026-06-15" },
  ];

  it("flags stale campaigns and old completions without a reply signal", () => {
    const failures = staleOutreach(tasks, asOf);
    expect(failures.map((f) => f.target)).toContain("/p-stale");
    expect(failures.map((f) => f.target)).toContain("/p-done-old");
    expect(failures.map((f) => f.target)).not.toContain("/p-fresh");
    const stale = failures.find((f) => f.target === "/p-stale");
    expect(stale?.correctiveAction).toContain("angle");
  });
});

describe("detectAllFailures", () => {
  const tasks: OutreachSample[] = [
    { pageUrl: "/p-stale", personalized: false, status: "in_progress", updatedAt: "2026-07-01" },
  ];

  it("combines every detector", () => {
    const failures = detectAllFailures(
      {
        articles,
        queries: [
          { query: "seo audit", date: "2026-07-20", clicks: 8, impressions: 200 },
          { query: "seo audit", date: "2026-07-21", clicks: 6, impressions: 180 },
          { query: "seo audit", date: "2026-07-27", clicks: 0, impressions: 40 },
          { query: "seo audit", date: "2026-07-28", clicks: 0, impressions: 30 },
        ],
        pages: [{ url: "/never", date: "2026-07-20", impressions: 300, position: 40 }],
        outreach: tasks,
      },
      asOf
    );
    const kinds = new Set(failures.map((f) => f.kind));
    expect(kinds).toContain("low_roi_content");
    expect(kinds).toContain("dead_keyword");
    expect(kinds).toContain("never_ranking");
    expect(kinds).toContain("poor_reply_outreach");
  });
});

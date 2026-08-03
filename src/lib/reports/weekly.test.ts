import { describe, expect, it } from "vitest";

import {
  ctrFrom,
  formatDate,
  formatDuration,
  formatMoney,
  formatPercent,
  renderWeeklyReport,
  toEmailHtml,
  toHtml,
  toMarkdown,
} from "@/lib/reports/weekly";
import type { WeeklyReportData } from "@/types";

const data: WeeklyReportData = {
  ownerId: "owner-1",
  periodStart: "2026-07-20",
  periodEnd: "2026-07-26",
  publishedCount: 3,
  impressions: 12000,
  clicks: 480,
  ctr: 4,
  topKeywords: [
    { keyword: "qr codes", impressions: 5200, clicks: 210, position: 4.2 },
    { keyword: "google reviews", impressions: 3100, clicks: 140, position: 6.1 },
  ],
  topPages: [
    { url: "/blog/qr-codes-reviews", visits: 890, clicks: 210 },
    { url: "/blog/review-habits", visits: 610, clicks: 120 },
  ],
  aiProductivity: {
    runs: 42,
    tokens: 89000,
    costUsd: 1.32,
    modules: { content: 30, social: 8, seo: 4 },
  },
  recommendations: ["Double down on QR-related content", "Add internal links to pricing"],
};

describe("formatting helpers", () => {
  it("formats percent", () => {
    expect(formatPercent(4)).toBe("4.00%");
    expect(formatPercent(120)).toBe("100.00%");
  });

  it("formats money", () => {
    expect(formatMoney(1.32)).toBe("$1.32");
  });

  it("formats duration", () => {
    expect(formatDuration(8100)).toBe("2h 15m");
    expect(formatDuration(45)).toBe("0m");
    expect(formatDuration(600)).toBe("10m");
    expect(formatDuration(-5)).toBe("0m");
  });

  it("computes CTR safely", () => {
    expect(ctrFrom(1000, 50)).toBe(5);
    expect(ctrFrom(0, 50)).toBe(0);
  });

  it("formats dates", () => {
    expect(formatDate("2026-07-20")).toContain("Jul");
    expect(formatDate("2026-07-20")).toContain("2026");
  });
});

describe("toMarkdown", () => {
  const md = toMarkdown(data);

  it("includes the title and period", () => {
    expect(md).toContain("# Weekly SEO Report");
    expect(md).toContain("Jul 20, 2026");
    expect(md).toContain("Jul 26, 2026");
  });

  it("includes highlights", () => {
    expect(md).toContain("**Published:** 3 article(s)");
    expect(md).toContain("**Impressions:** 12,000");
    expect(md).toContain("**Clicks:** 480");
    expect(md).toContain("**CTR:** 4.00%");
  });

  it("renders keyword table", () => {
    expect(md).toContain("## Top Keywords");
    expect(md).toContain("qr codes");
    expect(md).toContain("google reviews");
    expect(md).toContain("Keyword");
  });

  it("renders top pages table", () => {
    expect(md).toContain("## Top Pages");
    expect(md).toContain("/blog/qr-codes-reviews");
  });

  it("renders AI productivity section", () => {
    expect(md).toContain("## AI Productivity");
    expect(md).toContain("**Generation runs:** 42");
    expect(md).toContain("**Cost:** $1.32");
    expect(md).toContain("content");
    expect(md).toContain("social");
  });

  it("renders recommendations", () => {
    expect(md).toContain("## Recommendations");
    expect(md).toContain("Double down on QR-related content");
  });

  it("handles empty sections", () => {
    const empty = toMarkdown({ ...data, topKeywords: [], topPages: [], recommendations: [] });
    expect(empty).not.toContain("## Top Keywords");
    expect(empty).not.toContain("## Top Pages");
    expect(empty).not.toContain("## Recommendations");
  });
});

describe("toHtml", () => {
  const html = toHtml(data);

  it("produces a full document with styles", () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("Weekly SEO Report");
    expect(html).toContain("<style>");
  });

  it("renders KPI cards and keyword table", () => {
    expect(html).toContain("12,000");
    expect(html).toContain("<table>");
    expect(html).toContain("qr codes");
  });

  it("escapes HTML in recommendations", () => {
    const dirty = toHtml({ ...data, recommendations: ["Use <b>bold</b> & more"] });
    expect(dirty).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(dirty).not.toContain("<b>bold</b>");
  });
});

describe("toEmailHtml", () => {
  const email = toEmailHtml(data);

  it("uses inline styles and primary brand color", () => {
    expect(email).toContain("style=");
    expect(email).toContain("#22c55e");
    expect(email).toContain("Revuvia Weekly Report");
  });

  it("includes the dashboard CTA link", () => {
    expect(email).toContain("Open Dashboard");
    expect(email).toContain("https://revuvia.app/dashboard");
  });

  it("limits top keywords to 5 rows", () => {
    const big = toEmailHtml({
      ...data,
      topKeywords: Array.from({ length: 8 }, (_, i) => ({
        keyword: `kw-${i}`,
        impressions: 100,
        clicks: 10,
        position: 3,
      })),
    });
    expect(big.match(/kw-\d/g)?.length ?? 0).toBeLessThanOrEqual(5);
  });
});

describe("renderWeeklyReport", () => {
  it("returns all three formats", () => {
    const report = renderWeeklyReport(data);
    expect(report.markdown.length).toBeGreaterThan(0);
    expect(report.html.length).toBeGreaterThan(0);
    expect(report.emailHtml.length).toBeGreaterThan(0);
    expect(report.html).not.toBe(report.emailHtml);
  });
});

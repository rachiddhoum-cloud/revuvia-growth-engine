import { describe, expect, it } from "vitest";

import {
  buildCeoReport,
  ceoReportToHtml,
  ceoReportToMarkdown,
  humanDate,
  renderCeoReport,
} from "@/lib/ops/ceo-report";
import type { ActionPlan, GrowthSnapshot, SalesProspect } from "@/lib/ops";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  daily: [
    { metric_date: "2026-08-01", organic_visits: 250, clicks: 25, impressions: 750, conversions: 5, lead_downloads: 8, revenue: 30 },
  ],
  pages: [
    { url: "/blog/qr", visits: 100, clicks: 10, impressions: 300, ctr: 0.033, avg_position: 4 },
  ],
  content: [
    { id: "1", title: "QR guide", status: "published", quality_score: 90, created_at: "2026-07-30" },
  ],
  runs: [{ module: "content", status: "success", cost_usd: 0.5, created_at: "2026-08-01" }],
  customers: [
    { id: "c1", owner_id: "o", email: "a@b.c", company: "X", industry: null, status: "paid", plan: null, mrr_usd: 49, last_contact_at: null, created_at: "2026-07-01T00:00:00Z" },
    { id: "c2", owner_id: "o", email: "d@e.f", company: "Y", industry: null, status: "paid", plan: null, mrr_usd: 29, last_contact_at: null, created_at: "2026-07-10T00:00:00Z" },
    { id: "c3", owner_id: "o", email: "g@h.i", company: "Z", industry: null, status: "trial", plan: null, mrr_usd: 0, last_contact_at: null, created_at: "2026-07-15T00:00:00Z" },
  ],
  prospects: [],
  keywords: [],
});

const plan: ActionPlan = {
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  generatedAt: "2026-08-02T09:00:00Z",
  revenueForecastUsd: 150,
  actions: [
    { id: "a1", kind: "content", title: "Publish QR guide", description: "", priority: "P0", impact: 9, ease: 8, confidence: 0.8, ice: 500, mrrImpactUsd: 60, source: "x" },
    { id: "a2", kind: "sales", title: "Contact Cafe Luna", description: "", priority: "P1", impact: 6, ease: 9, confidence: 0.6, ice: 300, mrrImpactUsd: 40, source: "x" },
    { id: "a3", kind: "seo", title: "Refresh FAQ", description: "", priority: "P2", impact: 4, ease: 6, confidence: 0.7, ice: 180, mrrImpactUsd: 20, source: "x" },
  ],
};

const salesPlan: SalesProspect[] = [];

const input = { snapshot, actionPlan: plan, salesPlan, now: new Date("2026-08-02T09:00:00Z") };

describe("humanDate", () => {
  it("formats dates as weekday + day + month", () => {
    expect(humanDate("2026-08-02")).toContain("Aug");
  });
});

describe("buildCeoReport", () => {
  const report = buildCeoReport(input);

  it("computes MRR and customer counts", () => {
    expect(report.mrrUsd).toBe(78);
    expect(report.paidCustomers).toBe(2);
  });

  it("fills every required section", () => {
    expect(report.growthSummary.length).toBeGreaterThan(0);
    expect(report.revenueSummary.length).toBeGreaterThan(0);
    expect(report.trafficSummary.length).toBeGreaterThan(0);
    expect(report.conversionSummary.length).toBeGreaterThan(0);
    expect(report.seoEvolution.length).toBeGreaterThan(0);
    expect(report.contentPerformance.length).toBeGreaterThan(0);
    expect(report.topOpportunities.length).toBeGreaterThan(0);
    expect(report.problems.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.nextWeekRoadmap.length).toBeGreaterThan(0);
  });
});

describe("ceoReportToMarkdown", () => {
  it("produces a full markdown report with all sections", () => {
    const md = ceoReportToMarkdown(buildCeoReport(input));
    expect(md).toContain("# Weekly CEO Report");
    expect(md).toContain("## Growth summary");
    expect(md).toContain("## Revenue summary");
    expect(md).toContain("## Traffic");
    expect(md).toContain("## Conversion");
    expect(md).toContain("## SEO evolution");
    expect(md).toContain("## Content performance");
    expect(md).toContain("## Top opportunities");
    expect(md).toContain("## Problems");
    expect(md).toContain("## Recommendations");
    expect(md).toContain("## Next week's roadmap");
  });
});

describe("ceoReportToHtml", () => {
  it("renders print-ready HTML with KPIs", () => {
    const html = ceoReportToHtml(buildCeoReport(input));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("@page");
    expect(html).toContain("Weekly CEO Report");
    expect(html).toContain("$78.00");
  });
});

describe("renderCeoReport", () => {
  it("returns both markdown and html", () => {
    const rendered = renderCeoReport(input);
    expect(rendered.markdown.length).toBeGreaterThan(100);
    expect(rendered.html.length).toBeGreaterThan(200);
  });
});

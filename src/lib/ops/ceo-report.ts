/**
 * Weekly CEO Report — Sprint 3, Phase 7.
 *
 * Beautiful Markdown report with growth, revenue, traffic, conversion, SEO
 * evolution, content performance, top opportunities, problems,
 * recommendations and next week's roadmap. Also renders a print-ready HTML
 * (export to PDF). Pure and deterministic.
 */

import type { CeoReportData } from "@/lib/ops/types";
import type { ActionPlan, GrowthSnapshot, SalesProspect } from "@/lib/ops/types";
import { formatMoney, formatPercent } from "@/lib/reports/weekly";

export interface CeoReportInput {
  snapshot: GrowthSnapshot;
  actionPlan: ActionPlan;
  salesPlan: SalesProspect[];
  now?: Date;
}

export interface CeoReportRender {
  markdown: string;
  html: string;
}

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function humanDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
}

function deltaPct(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "new" : "—";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function buildCeoReport(input: CeoReportInput): CeoReportData {
  const { snapshot, actionPlan, salesPlan, now } = input;
  const { weekly, customers } = snapshot;
  const revenue = customers.mrrUsd;

  const seoEvolution = [
    `Visits ${weekly.visits} (${deltaPct(weekly.visits, 0)} vs last week)`,
    `Est. SEO traffic ${snapshot.estimatedSeoTraffic} (${deltaPct(snapshot.estimatedSeoTraffic, 0)})`,
    `Impressions ${weekly.impressions} · clicks ${weekly.clicks}`,
  ];

  const salesPipeline = salesPlan
    .slice(0, 3)
    .map((p) => `${p.company} (${Math.round(p.probability * 100)}%)`);

  return {
    weekStart: snapshot.weekStart,
    weekEnd: snapshot.weekEnd,
    generatedAt: (now ?? new Date()).toISOString(),
    growthSummary: [
      `${weekly.publishedCount} article(s) published`,
      `${weekly.signups} new signups`,
      `${customers.trial} trials · ${customers.paid} paid · ${customers.churned} churned`,
    ],
    revenueSummary: [
      `${formatMoney(revenue)} MRR (${customers.paid} paying)`,
      `AI cost ${formatMoney(weekly.aiCostUsd)} this week`,
      `Forecast ${formatMoney(actionPlan.revenueForecastUsd)} MRR from this plan`,
    ],
    trafficSummary: [
      `${weekly.visits} visits (${deltaPct(weekly.visits, 0)})`,
      `${weekly.clicks} clicks · ${formatPercent(weekly.impressions > 0 ? (weekly.clicks / weekly.impressions) * 100 : 0)} CTR`,
      `Estimated SEO traffic ${snapshot.estimatedSeoTraffic}`,
    ],
    conversionSummary: [
      `${formatPercent(snapshot.conversionRate * 100)} visits → signups`,
      `${weekly.leads} lead-magnet downloads`,
      `${weekly.conversions} conversions total`,
    ],
    seoEvolution,
    contentPerformance: [
      `Avg quality ${snapshot.qualityAverage.toFixed(0)}/100`,
      `Top pages: ${snapshot.pages.slice(0, 3).map((p) => `${p.visits ?? 0} visits ${p.url}`).join(", ") || "none yet"}`,
    ],
    topOpportunities: actionPlan.actions.slice(0, 3).map((a) => `${a.title} (ICE ${a.ice.toFixed(1)})`),
    problems: snapshot.customers.churned > 0 ? [`${snapshot.customers.churned} churned`] : ["None blocking"],
    recommendations: actionPlan.actions.slice(0, 5).map((a) => a.title),
    nextWeekRoadmap: [
      ...actionPlan.actions.slice(0, 3).map((a, i) => `${i + 1}. ${a.title}`),
      ...(salesPipeline.length > 0 ? [`4. Close: ${salesPipeline.join(", ")}`] : []),
    ],
    mrrUsd: revenue,
    paidCustomers: customers.paid,
    weeklyVisits: weekly.visits,
    weeklyLeads: weekly.leads,
    weeklySignups: weekly.signups,
    aiCostUsd: weekly.aiCostUsd,
    publishedCount: weekly.publishedCount,
  };
}

/** Full Markdown report (the primary deliverable). */
export function ceoReportToMarkdown(data: CeoReportData): string {
  const section = (title: string, items: string[]): string[] => [
    `## ${title}`,
    "",
    ...items.map((i) => `- ${i}`),
    "",
  ];

  const lines: string[] = [
    `# Weekly CEO Report — ${humanDate(data.weekStart)} → ${humanDate(data.weekEnd)}`,
    "",
    `_Generated ${new Date(data.generatedAt).toISOString().slice(0, 10)}_`,
    "",
    `## Summary`,
    "",
    `${data.weeklyVisits} visits · ${data.weeklySignups} signups · ${data.mrrUsd.toFixed(2)} MRR · AI cost ${data.aiCostUsd.toFixed(2)}`,
    "",
    ...section("Growth summary", data.growthSummary),
    ...section("Revenue summary", data.revenueSummary),
    ...section("Traffic", data.trafficSummary),
    ...section("Conversion", data.conversionSummary),
    ...section("SEO evolution", data.seoEvolution),
    ...section("Content performance", data.contentPerformance),
    ...section("Top opportunities", data.topOpportunities),
    ...section("Problems", data.problems),
    ...section("Recommendations", data.recommendations),
    `## Next week's roadmap`,
    "",
    ...data.nextWeekRoadmap.map((r) => `- ${r}`),
    "",
  ];
  return lines.join("\n");
}

/** Print-ready HTML for PDF export (A4-friendly, no external assets). */
export function ceoReportToHtml(data: CeoReportData): string {
  const section = (title: string, items: string[]): string => `
    <h2>${title}</h2>
    <ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Weekly CEO Report — Revuvia</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 20px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  ul { margin: 0 0 8px 18px; padding: 0; }
  li { font-size: 13px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  .summary { display: flex; gap: 12px; flex-wrap: wrap; }
  .summary div { flex: 1 1 140px; background: #f1f5f9; border-radius: 8px; padding: 12px; }
  .summary b { display: block; font-size: 18px; }
  .summary span { font-size: 11px; color: #64748b; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1>Weekly CEO Report</h1>
  <div class="meta">${humanDate(data.weekStart)} → ${humanDate(data.weekEnd)} · Generated ${new Date(data.generatedAt).toISOString().slice(0, 10)}</div>
  <div class="summary">
    <div><b>${data.weeklyVisits}</b><span>Visits</span></div>
    <div><b>${data.weeklySignups}</b><span>Signups</span></div>
    <div><b>$${data.mrrUsd.toFixed(2)}</b><span>MRR</span></div>
    <div><b>$${data.aiCostUsd.toFixed(2)}</b><span>AI cost</span></div>
  </div>
  ${section("Growth summary", data.growthSummary)}
  ${section("Revenue summary", data.revenueSummary)}
  ${section("Traffic", data.trafficSummary)}
  ${section("Conversion", data.conversionSummary)}
  ${section("SEO evolution", data.seoEvolution)}
  ${section("Content performance", data.contentPerformance)}
  ${section("Top opportunities", data.topOpportunities)}
  ${section("Problems", data.problems)}
  ${section("Recommendations", data.recommendations)}
  ${section("Next week's roadmap", data.nextWeekRoadmap)}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render both formats from raw input (convenience for routes/tests). */
export function renderCeoReport(input: CeoReportInput): CeoReportRender {
  return {
    markdown: ceoReportToMarkdown(buildCeoReport(input)),
    html: ceoReportToHtml(buildCeoReport(input)),
  };
}

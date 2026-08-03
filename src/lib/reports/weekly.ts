/**
 * Weekly Report — Phase 5.
 *
 * Renders a `WeeklyReportData` bundle into three deliverables:
 *   - Markdown  (internal / README-style digest)
 *   - HTML      (embedded dashboards, admin view)
 *   - Email HTML (inline-styled, newsletter-safe)
 *
 * Pure and deterministic — no IO, no AI. All formatting helpers are exported
 * for granular unit testing.
 */

import type { WeeklyReportData } from "@/types";
import { clamp } from "@/lib/utils";

export interface WeeklyReportRender {
  markdown: string;
  html: string;
  emailHtml: string;
}

export const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const EMAIL_PRIMARY_COLOR = "#22c55e";

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value)
  );
}

export function formatPercent(value: number): string {
  return `${(clamp(value, 0, 100)).toFixed(2)}%`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value
  );
}

/** Human duration, e.g. "2h 15m". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ctrFrom(impressions: number, clicks: number): number {
  if (impressions <= 0) return 0;
  return (clicks / impressions) * 100;
}

function markdownTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const line = (cells: string[]): string =>
    `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  const sep = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  return [line(headers), sep, ...rows.map(line)].join("\n");
}

/** Build a Markdown digest from weekly data. */
export function toMarkdown(data: WeeklyReportData): string {
  const lines: string[] = [];
  lines.push(`# Weekly SEO Report — ${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)}`);
  lines.push("");
  lines.push("## Highlights");
  lines.push("");
  lines.push(`- **Published:** ${data.publishedCount} article(s)`);
  lines.push(`- **Impressions:** ${data.impressions.toLocaleString("en-US")}`);
  lines.push(`- **Clicks:** ${data.clicks.toLocaleString("en-US")}`);
  lines.push(`- **CTR:** ${formatPercent(data.ctr)}`);
  lines.push("");

  if (data.topKeywords.length > 0) {
    lines.push("## Top Keywords");
    lines.push("");
    lines.push(
      markdownTable(
        ["Keyword", "Impressions", "Clicks", "Position"],
        data.topKeywords.map((k) => [
          k.keyword,
          k.impressions.toLocaleString("en-US"),
          k.clicks.toLocaleString("en-US"),
          k.position.toFixed(1),
        ])
      )
    );
    lines.push("");
  }

  if (data.topPages.length > 0) {
    lines.push("## Top Pages");
    lines.push("");
    lines.push(
      markdownTable(
        ["URL", "Visits", "Clicks"],
        data.topPages.map((p) => [p.url, p.visits.toLocaleString("en-US"), p.clicks.toLocaleString("en-US")])
      )
    );
    lines.push("");
  }

  lines.push("## AI Productivity");
  lines.push("");
  lines.push(`- **Generation runs:** ${data.aiProductivity.runs}`);
  lines.push(`- **Tokens:** ${data.aiProductivity.tokens.toLocaleString("en-US")}`);
  lines.push(`- **Cost:** ${formatMoney(data.aiProductivity.costUsd)}`);
  const modules = Object.entries(data.aiProductivity.modules);
  if (modules.length > 0) {
    lines.push("");
    lines.push("### By module");
    lines.push("");
    lines.push(
      markdownTable(
        ["Module", "Runs"],
        modules.map(([module, runs]) => [module, String(runs)])
      )
    );
    lines.push("");
  }

  if (data.recommendations.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    for (const rec of data.recommendations) lines.push(`- ${rec}`);
    lines.push("");
  }

  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build a full HTML page (embedded in the admin dashboard). */
export function toHtml(data: WeeklyReportData): string {
  const rows =
    data.topKeywords
      .map(
        (k) =>
          `<tr><td>${escapeHtml(k.keyword)}</td><td>${k.impressions.toLocaleString("en-US")}</td>` +
          `<td>${k.clicks.toLocaleString("en-US")}</td><td>${k.position.toFixed(1)}</td></tr>`
      )
      .join("") || '<tr><td colspan="4">No keyword data yet.</td></tr>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Weekly SEO Report</title>
<style>
  body { font-family: ${EMAIL_FONT_STACK}; color: #0f172a; margin: 0; background: #f8fafc; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 12px; color: #334155; }
  .kpi { display: flex; gap: 16px; flex-wrap: wrap; }
  .kpi div { flex: 1 1 140px; background: #f1f5f9; border-radius: 8px; padding: 12px; }
  .kpi b { display: block; font-size: 20px; }
  .kpi span { font-size: 12px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  th { color: #64748b; font-weight: 600; }
  ul { margin: 8px 0 0; padding-left: 20px; }
  li { margin-bottom: 4px; }
  .muted { color: #64748b; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>Weekly SEO Report</h1>
    <div class="muted">${formatDate(data.periodStart)} → ${formatDate(data.periodEnd)}</div>
  </div>
  <div class="card">
    <h2>Highlights</h2>
    <div class="kpi">
      <div><b>${data.publishedCount}</b><span>Articles published</span></div>
      <div><b>${data.impressions.toLocaleString("en-US")}</b><span>Impressions</span></div>
      <div><b>${data.clicks.toLocaleString("en-US")}</b><span>Clicks</span></div>
      <div><b>${formatPercent(data.ctr)}</b><span>CTR</span></div>
    </div>
  </div>
  <div class="card">
    <h2>Top Keywords</h2>
    <table>
      <thead><tr><th>Keyword</th><th>Impressions</th><th>Clicks</th><th>Position</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="card">
    <h2>AI Productivity</h2>
    <p><b>${data.aiProductivity.runs}</b> generation runs · ${data.aiProductivity.tokens.toLocaleString("en-US")} tokens · ${formatMoney(data.aiProductivity.costUsd)}</p>
  </div>
  ${data.recommendations.length > 0
    ? `<div class="card"><h2>Recommendations</h2><ul>${data.recommendations
        .map((r) => `<li>${escapeHtml(r)}</li>`)
        .join("")}</ul></div>`
    : ""}
</div>
</body>
</html>`;
}

const EMAIL_CTA_URL = "https://revuvia.app/dashboard";

/** Build an inline-styled email (newsletter-safe, no external CSS). */
export function toEmailHtml(data: WeeklyReportData): string {
  const keywordRows =
    data.topKeywords
      .slice(0, 5)
      .map(
        (k) =>
          `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#0f172a">${escapeHtml(k.keyword)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eef2f7;font-size:13px;text-align:right;color:#475569">${k.impressions.toLocaleString("en-US")}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eef2f7;font-size:13px;text-align:right;color:#475569">${k.clicks.toLocaleString("en-US")}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eef2f7;font-size:13px;text-align:right;color:#475569">${k.position.toFixed(1)}</td>
          </tr>`
      )
      .join("") || "";

  const recommendations =
    data.recommendations.length > 0
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eef2f7">
          <h3 style="margin:16px 0 8px;font-size:15px;color:#0f172a">Recommendations</h3>
          <ul style="margin:0;padding-left:18px">${data.recommendations
            .map((r) => `<li style="margin-bottom:6px;font-size:13px;color:#334155">${escapeHtml(r)}</li>`)
            .join("")}</ul>
        </td></tr>`
      : "";

  return `<div style="background:#f6f8fa;padding:24px 0;font-family:${EMAIL_FONT_STACK}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
          <tr>
            <td style="background:${EMAIL_PRIMARY_COLOR};padding:20px 28px">
              <h1 style="margin:0;color:#ffffff;font-size:20px">Revuvia Weekly Report</h1>
              <div style="color:#ffffff;opacity:.85;font-size:12px;margin-top:4px">${formatDate(data.periodStart)} → ${formatDate(data.periodEnd)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="25%" style="padding:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#0f172a">${data.publishedCount}</div>
                    <div style="font-size:11px;color:#64748b">Articles</div>
                  </td>
                  <td width="25%" style="padding:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#0f172a">${data.impressions.toLocaleString("en-US")}</div>
                    <div style="font-size:11px;color:#64748b">Impressions</div>
                  </td>
                  <td width="25%" style="padding:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#0f172a">${data.clicks.toLocaleString("en-US")}</div>
                    <div style="font-size:11px;color:#64748b">Clicks</div>
                  </td>
                  <td width="25%" style="padding:8px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#0f172a">${formatPercent(data.ctr)}</div>
                    <div style="font-size:11px;color:#64748b">CTR</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px">
                <tr><td style="border-top:1px solid #eef2f7;padding:16px 0">
                  <h2 style="margin:0 0 4px;font-size:15px;color:#0f172a">Top Keywords</h2>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:8px 0;font-size:11px;color:#64748b;border-bottom:1px solid #eef2f7">Keyword</td>
                      <td style="padding:8px 0;font-size:11px;color:#64748b;border-bottom:1px solid #eef2f7;text-align:right">Impr.</td>
                      <td style="padding:8px 0;font-size:11px;color:#64748b;border-bottom:1px solid #eef2f7;text-align:right">Clicks</td>
                      <td style="padding:8px 0;font-size:11px;color:#64748b;border-bottom:1px solid #eef2f7;text-align:right">Pos.</td>
                    </tr>
                    ${keywordRows}
                  </table>
                </td></tr>
                <tr><td style="border-top:1px solid #eef2f7;padding:16px 0">
                  <h2 style="margin:0 0 4px;font-size:15px;color:#0f172a">AI Productivity</h2>
                  <p style="margin:0;font-size:13px;color:#334155">
                    ${data.aiProductivity.runs} generation runs · ${data.aiProductivity.tokens.toLocaleString("en-US")} tokens · ${formatMoney(data.aiProductivity.costUsd)}
                  </p>
                </td></tr>
                ${recommendations}
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px">
                <tr>
                  <td align="center" style="padding:8px 0">
                    <a href="${EMAIL_CTA_URL}" style="display:inline-block;background:${EMAIL_PRIMARY_COLOR};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">
                      Open Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center">
              Generated automatically by Revuvia Growth Engine.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

/** Render a weekly report in all three formats. */
export function renderWeeklyReport(data: WeeklyReportData): WeeklyReportRender {
  return {
    markdown: toMarkdown(data),
    html: toHtml(data),
    emailHtml: toEmailHtml(data),
  };
}

/** Convenience wrapper for the reports barrel. */
export function buildWeeklyReport(data: WeeklyReportData): WeeklyReportRender {
  return renderWeeklyReport(data);
}

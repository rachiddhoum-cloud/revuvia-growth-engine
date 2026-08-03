/**
 * Reusable email templates.
 * Pure functions returning `{ html, text }` — easy to test and extend.
 * Styles are inline (email client compatible).
 */

export interface WeeklyReportData {
  weekLabel: string;
  organicVisits: number;
  clicks: number;
  conversions: number;
  leadDownloads: number;
  publishedCount: number;
  topPages: Array<{ url: string; visits: number }>;
  dashboardUrl: string;
}

export interface LeadMagnetData {
  leadName?: string;
  downloadUrl: string;
  magnetTitle: string;
  appUrl: string;
}

export interface CampaignData {
  headline: string;
  bodyHtml: string;
  ctaUrl: string;
  ctaLabel: string;
  appUrl: string;
}

export interface NotificationData {
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  appUrl: string;
}

const BRAND_COLOR = "#7c6cf5";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(innerHtml: string, appUrl: string, preheader?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Revuvia</title>
    ${preheader ? `<meta name="description" content="${escapeHtml(preheader)}" />` : ""}
  </head>
  <body style="margin:0;padding:0;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#17181c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;background:${BRAND_COLOR};color:#ffffff;">
                <h1 style="margin:0;font-size:18px;line-height:1.3;">Revuvia Growth Engine</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #ececf0;font-size:12px;color:#8a8b91;">
                You received this email because you use Revuvia Growth Engine.
                <a href="${escapeHtml(appUrl)}" style="color:#8a8b91;">Visit dashboard</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function weeklyReportTemplate(data: WeeklyReportData): { html: string; text: string } {
  const pageRows = data.topPages
    .slice(0, 5)
    .map(
      (p) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f3;font-size:13px;">${escapeHtml(p.url)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f3;font-size:13px;text-align:right;">${number(p.visits)}</td>
        </tr>`
    )
    .join("");

  const html = shell(
    `<h2 style="margin:0 0 8px;font-size:20px;">Weekly report — ${escapeHtml(data.weekLabel)}</h2>
    <p style="margin:0 0 24px;color:#5a5b62;font-size:14px;">Here is how your SEO content performed this week.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:25%;padding:12px;background:#f7f7fb;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:700;">${number(data.organicVisits)}</div>
          <div style="font-size:11px;color:#8a8b91;">Organic visits</div>
        </td>
        <td style="width:8px;"></td>
        <td style="width:25%;padding:12px;background:#f7f7fb;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:700;">${number(data.clicks)}</div>
          <div style="font-size:11px;color:#8a8b91;">Clicks</div>
        </td>
        <td style="width:8px;"></td>
        <td style="width:25%;padding:12px;background:#f7f7fb;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:700;">${number(data.conversions)}</div>
          <div style="font-size:11px;color:#8a8b91;">Conversions</div>
        </td>
        <td style="width:8px;"></td>
        <td style="width:25%;padding:12px;background:#f7f7fb;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:700;">${number(data.leadDownloads)}</div>
          <div style="font-size:11px;color:#8a8b91;">Lead downloads</div>
        </td>
      </tr>
    </table>
    <h3 style="margin:0 0 8px;font-size:14px;">Top pages</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${pageRows || '<tr><td style="font-size:13px;color:#8a8b91;">No page metrics yet.</td></tr>'}
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#5a5b62;">${number(data.publishedCount)} content items published this week.</p>
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(data.dashboardUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;">Open dashboard</a>
    </p>`,
    data.dashboardUrl,
    `Your weekly Revuvia SEO report — ${number(data.organicVisits)} organic visits.`
  );

  const text = `Weekly report — ${data.weekLabel}
Organic visits: ${number(data.organicVisits)}
Clicks: ${number(data.clicks)}
Conversions: ${number(data.conversions)}
Lead downloads: ${number(data.leadDownloads)}
Published this week: ${number(data.publishedCount)}
Top pages:
${data.topPages.slice(0, 5).map((p) => `- ${p.url}: ${number(p.visits)} visits`).join("\n") || "No page metrics yet."}

Open dashboard: ${data.dashboardUrl}`;

  return { html, text };
}

export function leadMagnetTemplate(data: LeadMagnetData): { html: string; text: string } {
  const html = shell(
    `<h2 style="margin:0 0 8px;font-size:20px;">Your download is ready</h2>
    <p style="margin:0 0 20px;color:#5a5b62;font-size:14px;">
      ${data.leadName ? `Hi ${escapeHtml(data.leadName)}, ` : ""}here is your copy of <strong>${escapeHtml(data.magnetTitle)}</strong>.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(data.downloadUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;">Download now</a>
    </p>
    <p style="margin:0;font-size:13px;color:#5a5b62;">
      Want more Google reviews? Explore how Revuvia turns happy customers into 5-star reviews.
    </p>`,
    data.appUrl
  );

  const text = `Your download is ready
${data.leadName ? `Hi ${data.leadName}, ` : ""}here is your copy of ${data.magnetTitle}.

Download: ${data.downloadUrl}

Want more Google reviews? Explore Revuvia: ${data.appUrl}`;

  return { html, text };
}

export function campaignTemplate(data: CampaignData): { html: string; text: string } {
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">${escapeHtml(data.headline)}</h2>
    <div style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#2a2b31;">${data.bodyHtml}</div>
    <p style="margin:0 0 8px;">
      <a href="${escapeHtml(data.ctaUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;">${escapeHtml(data.ctaLabel)}</a>
    </p>`,
    data.appUrl
  );

  const text = `${data.headline}

${data.bodyHtml.replace(/<[^>]+>/g, "")}

${data.ctaLabel}: ${data.ctaUrl}`;

  return { html, text };
}

export function notificationTemplate(data: NotificationData): { html: string; text: string } {
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">${escapeHtml(data.title)}</h2>
    <div style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#2a2b31;">${data.bodyHtml}</div>
    ${
      data.ctaUrl && data.ctaLabel
        ? `<p style="margin:0;">
            <a href="${escapeHtml(data.ctaUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;">${escapeHtml(data.ctaLabel)}</a>
          </p>`
        : ""
    }`,
    data.appUrl
  );

  const text = `${data.title}

${data.bodyHtml.replace(/<[^>]+>/g, "")}
${data.ctaUrl && data.ctaLabel ? `\n${data.ctaLabel}: ${data.ctaUrl}` : ""}`;

  return { html, text };
}

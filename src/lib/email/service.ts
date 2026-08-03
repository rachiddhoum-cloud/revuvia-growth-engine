/**
 * Email service — senders for weekly reports, lead magnet delivery, campaigns
 * and notifications. Wraps Resend with retry + timeout.
 */

import { defaultFrom, getResend, isResendConfigured } from "@/lib/email/client";
import {
  campaignTemplate,
  leadMagnetTemplate,
  notificationTemplate,
  weeklyReportTemplate,
  type CampaignData,
  type LeadMagnetData,
  type NotificationData,
  type WeeklyReportData,
} from "@/lib/email/templates";
import { withRetry, withTimeout } from "@/lib/reliability";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  tags?: Array<{ name: string; value: string }>;
}

const EMAIL_TIMEOUT_MS = 30_000;

/** Low-level send with retry + timeout. */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const resend = getResend();
  const result = await withTimeout(
    withRetry(
      () =>
        resend.emails.send({
          from: defaultFrom(),
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.tags ? { tags: input.tags } : {}),
        }),
      { attempts: 3, baseDelayMs: 500, maxDelayMs: 4_000 }
    ),
    EMAIL_TIMEOUT_MS,
    "Email send timed out"
  );

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result.data?.id ?? "ok";
}

export async function sendWeeklyReport(
  to: string,
  data: WeeklyReportData
): Promise<string> {
  const { html, text } = weeklyReportTemplate(data);
  return sendEmail({
    to,
    subject: `Weekly SEO report — ${data.weekLabel}`,
    html,
    text,
    tags: [{ name: "type", value: "weekly-report" }],
  });
}

export async function sendLeadMagnet(
  to: string,
  data: LeadMagnetData
): Promise<string> {
  const { html, text } = leadMagnetTemplate(data);
  return sendEmail({
    to,
    subject: `Your download: ${data.magnetTitle}`,
    html,
    text,
    tags: [{ name: "type", value: "lead-magnet" }],
  });
}

export async function sendCampaignEmail(
  to: string | string[],
  data: CampaignData
): Promise<string> {
  const { html, text } = campaignTemplate(data);
  return sendEmail({
    to,
    subject: data.headline,
    html,
    text,
    tags: [{ name: "type", value: "campaign" }],
  });
}

export async function sendNotificationEmail(
  to: string,
  data: NotificationData
): Promise<string> {
  const { html, text } = notificationTemplate(data);
  return sendEmail({
    to,
    subject: data.title,
    html,
    text,
    tags: [{ name: "type", value: "notification" }],
  });
}

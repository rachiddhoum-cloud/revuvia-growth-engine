/**
 * Email barrel export.
 */

export { getResend, isResendConfigured, defaultFrom } from "@/lib/email/client";
export {
  sendEmail,
  sendWeeklyReport,
  sendLeadMagnet,
  sendCampaignEmail,
  sendNotificationEmail,
} from "@/lib/email/service";
export type { SendEmailInput } from "@/lib/email/service";
export {
  weeklyReportTemplate,
  leadMagnetTemplate,
  campaignTemplate,
  notificationTemplate,
} from "@/lib/email/templates";
export type {
  WeeklyReportData,
  LeadMagnetData,
  CampaignData,
  NotificationData,
} from "@/lib/email/templates";

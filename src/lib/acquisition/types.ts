/** Customer Acquisition System — shared types (Growth Engine only). */

export type ContentStatus = "planned" | "brief" | "writing" | "review" | "published" | "archived";
export type PageRole = "none" | "pillar" | "supporting";
export type CtaType =
  | "qr_generator"
  | "review_potential"
  | "review_audit"
  | "start_free"
  | "trial"
  | "demo"
  | "download"
  | "custom";

export type JourneyStage =
  | "anonymous"
  | "lead"
  | "registered"
  | "trial"
  | "paid"
  | "cancelled"
  | "recovered";

export type LeadStatus =
  | "new"
  | "nurturing"
  | "qualified"
  | "registered"
  | "trial"
  | "paid"
  | "lost"
  | "unsubscribed";

export interface ContentHubRow {
  id: string;
  keyword: string;
  cluster_name: string | null;
  volume: number;
  difficulty: number;
  intent: string | null;
  content_status: ContentStatus;
  page_role: PageRole;
  traffic_estimate: number;
  expected_leads: number;
  expected_mrr: number;
  priority: number;
  opportunity_score: number;
  content_title: string | null;
  content_slug: string | null;
}

export interface FunnelStage {
  stage: JourneyStage;
  label: string;
  count: number;
  conversionRate: number;
}

export interface CasDashboardModel {
  traffic: { weekly: number; deltaPct: number };
  seo: { keywords: number; published: number; pillars: number };
  leads: { total: number; thisWeek: number; conversionRate: number };
  email: { sent: number; openRate: number; clickRate: number; unsubscribeRate: number };
  revenue: { mrrUsd: number; paidCustomers: number; cacEstimateUsd: number; roiEstimate: number };
  topContent: { title: string; leads: number; mrrUsd: number }[];
  topCta: { label: string; clicks: number; conversions: number }[];
  topEmail: { subject: string; openRate: number; clickRate: number }[];
  topChannel: { channel: string; conversions: number }[];
}

export interface RevenueAuditKpis {
  visitors: number;
  ctaImpressions: number;
  ctaClicks: number;
  ctaCtr: number;
  leadsCaptured: number;
  emailEnrollments: number;
  emailDeliveries: number;
  trialActivations: number;
  paidSubscriptions: number;
  failedPayments: number;
}

export interface MetricBlocker {
  metric: string;
  value: number;
  blocker: string;
  why: string;
  lostMrrUsd: number;
  action: string;
  ice: { impact: number; confidence: number; ease: number; score: number };
}

export interface DormantOutreach {
  email: string;
  signedUpAt: string;
  daysDormant: number;
  emailDraft: string;
  whatsAppDraft: string;
  followUpDraft: string;
}

export interface IceAction {
  rank: number;
  action: string;
  ice: number;
}

export interface RevenueAuditResult {
  date: string;
  kpis: RevenueAuditKpis;
  blockers: MetricBlocker[];
  biggestBlocker: MetricBlocker;
  highestRoiAction: { action: string; ice: number };
  revenueForecast: { days7: number; days30: number; note: string };
  customersAtRisk: string[];
  dormantLeads: DormantOutreach[];
  trialsWithoutActivation: DormantOutreach[];
  emailsWaiting: { email: string; step: number; dueAt: string }[];
  cronFailures: { cron: string; reason: string; fix: string; logs: string }[];
  failedAutomations: string[];
  acquisitionPlan: string[] | null;
  activationPlan: string[] | null;
  salesPlan: string[] | null;
  iceActions: IceAction[];
}

export interface FounderBriefing {
  date: string;
  yesterday: {
    visitors: number;
    leads: number;
    paidCustomers: number;
  };
  bestArticle: string | null;
  worstFunnel: string | null;
  recommendedAction: string;
  highestRoiTask: string;
  readMinutes: number;
  /** Revenue Operations daily audit (auto-generated). */
  revenue?: RevenueAuditResult;
}

export interface SalesPriorityRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  stage: string;
  potentialMrrUsd: number;
  iceScore: number;
  closeProbability: number;
  recommendedChannel: string;
  messagePreview: string;
}

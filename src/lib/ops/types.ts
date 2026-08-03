/**
 * Growth Operating System — Sprint 3.
 *
 * Shared types for the founder-ops layer. Generators are pure and
 * deterministic: they take a `GrowthSnapshot` (already aggregated from raw
 * Supabase rows) and return ranked, actionable outputs. No IO here.
 */

import type { ProspectRow } from "@/types/supabase";
import type {
  ContentItemRow,
  DailyMetricRow,
  GenerationRunRow,
  PageMetricRow,
} from "@/lib/analytics/aggregate";

export type ActionPriority = "P0" | "P1" | "P2";

export type ActionKind = "content" | "sales" | "seo" | "revenue" | "health";

export interface ScoredAction {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  priority: ActionPriority;
  /** 1-10 expected impact. */
  impact: number;
  /** 1-10 expected effort (10 = trivial). */
  ease: number;
  /** 0-1 confidence the action delivers. */
  confidence: number;
  /** ICE score = impact * confidence * ease. */
  ice: number;
  /** Estimated weekly MRR impact in USD. */
  mrrImpactUsd: number;
  source: string;
}

export interface ContentIdea {
  id: string;
  title: string;
  kind: "article" | "landing" | "lead_magnet";
  keyword: string;
  trafficPotential: number; // 1-10
  businessValue: number; // 1-10
  difficulty: number; // 1-10 (10 = easy)
  revenueImpact: number; // 1-10
  aiCostUsd: number; // estimated AI cost
  ice: number;
}

export interface SeoMission {
  id: string;
  kind: "traffic_loss" | "internal_links" | "keyword_attack" | "competitor" | "quick_win";
  title: string;
  detail: string;
  impact: number; // 1-10
  ease: number; // 1-10
  ice: number;
}

export interface SalesProspect {
  id: string;
  company: string;
  industry: string | null;
  contactName: string | null;
  email: string | null;
  status: ProspectRow["status"];
  priorityScore: number; // 0-100
  lastInteractionAt: string | null;
  recommendedMessage: string;
  followUpAt: string; // yyyy-mm-dd
  probability: number; // 0-1
}

export interface ActionPlan {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  actions: ScoredAction[]; // sorted by ICE desc
  revenueForecastUsd: number;
}

export interface DailyBrief {
  date: string;
  priorities: string[];
  opportunities: string[];
  urgentIssues: string[];
  marketingKpi: string;
  salesKpi: string;
  trafficKpi: string;
  revenueKpi: string;
  readMinutes: number;
}

export interface CeoReportData {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  growthSummary: string[];
  revenueSummary: string[];
  trafficSummary: string[];
  conversionSummary: string[];
  seoEvolution: string[];
  contentPerformance: string[];
  topOpportunities: string[];
  problems: string[];
  recommendations: string[];
  nextWeekRoadmap: string[];
  mrrUsd: number;
  paidCustomers: number;
  weeklyVisits: number;
  weeklyLeads: number;
  weeklySignups: number;
  aiCostUsd: number;
  publishedCount: number;
}

/** Weekly aggregates used by every generator. */
export interface WeeklyMetrics {
  visits: number;
  clicks: number;
  impressions: number;
  conversions: number;
  leads: number;
  signups: number;
  aiRuns: number;
  aiCostUsd: number;
  publishedCount: number;
}

export interface GrowthSnapshot {
  weekStart: string;
  weekEnd: string;
  weekly: WeeklyMetrics;
  previous: WeeklyMetrics;
  conversionRate: number; // signups / visits
  estimatedSeoTraffic: number; // visits adjusted by impression benchmark
  customers: { trial: number; paid: number; churned: number; mrrUsd: number };
  qualityAverage: number; // 0-100 across scored content
  pages: PageMetricRow[];
  content: ContentItemRow[];
  runs: GenerationRunRow[];
  prospects: ProspectRow[];
  daily: DailyMetricRow[];
  keywords: string[];
}

// ─────────────────────────────────────────────
// Sprint 4 — autonomous execution types
// ─────────────────────────────────────────────

export type PublishPlatform = "blog" | "linkedin" | "facebook" | "x";

export interface ArticleRef {
  id: string;
  title: string;
  slug?: string;
  excerpt?: string;
}

export interface PublishingSlot {
  id: string;
  contentItemId: string;
  title: string;
  platform: PublishPlatform;
  scheduledFor: string; // yyyy-mm-dd
  status: "scheduled" | "published" | "failed";
  draft: string;
}

export interface PublishingPlan {
  weekStart: string;
  weekEnd: string;
  slots: PublishingSlot[]; // sorted by scheduledFor
}

export interface LinkingSuggestion {
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  anchor: string;
  reason: string;
}

export interface InternalLinkingPlan {
  generatedAt: string;
  suggestions: LinkingSuggestion[];
  orphans: { id: string; title: string }[];
  coveragePct: number; // % of articles with >= 1 incoming suggestion
}

export type SeoTaskSource = "declining_page" | "rising_competitor" | "keyword_gap";

export interface SeoOptimizationTask {
  id: string;
  source: SeoTaskSource;
  title: string;
  detail: string;
  impact: number; // 1-10
  ease: number; // 1-10
  ice: number;
}

export interface SeoOptimizationPlan {
  weekStart: string;
  weekEnd: string;
  tasks: SeoOptimizationTask[]; // sorted by ICE desc
  decliningPages: string[];
  risingCompetitors: string[];
  keywordGaps: string[];
}

export type LeadItemKind = "lead_magnet" | "landing_page" | "cta" | "email_sequence";

export interface LeadGenerationItem {
  id: string;
  kind: LeadItemKind;
  title: string;
  detail: string;
  impact: number; // 1-10
  ease: number; // 1-10
  ice: number;
}

export interface LeadGenerationPlan {
  weekStart: string;
  weekEnd: string;
  items: LeadGenerationItem[]; // sorted by ICE desc
  topMagnets: string[];
}

export type OpportunityKind = "seasonal" | "trending" | "local" | "competitor_weakness";

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  detail: string;
  roiScore: number; // 0-100
  estTraffic: number;
  estLeads: number;
  estMrrUsd: number;
}

export interface OpportunityScan {
  weekStart: string;
  weekEnd: string;
  opportunities: Opportunity[]; // ranked by roiScore desc
}

export type CalendarHorizon = "daily" | "weekly" | "monthly";

export interface CalendarTask {
  id: string;
  date: string; // yyyy-mm-dd
  horizon: CalendarHorizon;
  title: string;
  source: string;
  priority: ActionPriority;
  deadline: string;
  roiUsd: number;
  estTraffic: number;
  estLeads: number;
  estMrrUsd: number;
}

export interface ExecutionCalendar {
  weekStart: string;
  weekEnd: string;
  tasks: CalendarTask[]; // sorted by date, then priority
  totals: { roiUsd: number; traffic: number; leads: number; mrrUsd: number };
}

export interface InboxPriority {
  rank: number;
  title: string;
  why: string;
  effortMinutes: number;
  priority: ActionPriority;
}

export interface FounderInbox {
  date: string;
  priorities: InboxPriority[]; // exactly 5
  readMinutes: number; // always <= 2
  urgentIssues: string[];
}

export type ScoreDimension =
  | "seo"
  | "content"
  | "traffic"
  | "leads"
  | "conversion"
  | "revenue"
  | "execution";

export interface GrowthScoreDimensions {
  seo: number;
  content: number;
  traffic: number;
  leads: number;
  conversion: number;
  revenue: number;
  execution: number;
}

export interface GrowthScore {
  date: string;
  total: number; // 0-100
  dimensions: GrowthScoreDimensions;
  trend: "up" | "down" | "flat";
  previousTotal: number | null;
}

/**
 * Commercialization OS — Sprint 9.
 *
 * Domain types for the automated acquisition funnel: prospect intelligence,
 * lead scoring, outbound outreach kits, pipeline, daily sales queue,
 * follow-up engine, sales analytics and the CEO sales report.
 * All engines here are pure and deterministic.
 */

import type { ProspectRow, ProspectMessageChannel, ProspectStatus } from "@/types/supabase";
import type { SalesProspect } from "@/lib/ops/types";

/** A prospect enriched with acquisition intelligence (Sprint 9 fields). */
export type IntelligenceProspect = ProspectRow & {
  score: LeadScore;
};

/** Lead temperature bucket derived from the total score. */
export type LeadTemperature = "hot" | "warm" | "cold";

/** Normalized digital presence summary derived from social fields. */
export interface DigitalPresence {
  /** 0-100: how discoverable the business is online. */
  score: number;
  channels: ProspectMessageChannel[];
  /** Named channels actually present (website, google maps, socials...). */
  owned: string[];
  /** Named channels the business is missing. */
  missing: string[];
}

export interface LeadScore {
  /** 0-100 combined opportunity score. */
  total: number;
  /** 0-100: digital presence strength. */
  digitalPresence: number;
  /** 0-100: how weak the reviews situation is (high = big opportunity). */
  reviewsWeakness: number;
  /** 0-100: how weak the SEO situation is (high = big opportunity). */
  seoWeakness: number;
  /** 0-100: estimated revenue potential from traffic × ACV. */
  revenuePotential: number;
  /** 0-100: how urgent the fix is (visible reviews/traffic damage). */
  urgency: number;
  /** 0-100: competitive pressure in the niche. */
  competition: number;
  /** Expected win probability 0-1 (reuses ops expectedProbability). */
  probability: number;
  /** ICE-style priority 0-1000. */
  ice: number;
  temperature: LeadTemperature;
}

/** One outbound message of a personalized outreach kit. */
export interface OutreachMessage {
  channel: ProspectMessageChannel;
  templateKey: string;
  subject: string | null;
  body: string;
  /** Scheduled delay in days from the first touch. */
  delayDays: number;
  /** True when this touch escalates to a different channel. */
  escalation?: boolean;
}

/** Full personalized outreach kit for a prospect (Phase 3). */
export interface OutreachKit {
  prospectId: string;
  company: string;
  industry: string | null;
  contactName: string | null;
  /** Detected business problems driving the pitch. */
  problems: string[];
  /** Benefits this business can expect. */
  benefits: string[];
  firstTouch: OutreachMessage;
  followUps: OutreachMessage[];
}

/** Canonical pipeline stage ordering and transitions (Phase 4). */
export interface PipelineDefinition {
  stages: ProspectStatus[];
  /** Stage -> stages reachable in one transition. */
  transitions: Record<ProspectStatus, ProspectStatus[]>;
  /** Expected win probability per stage. */
  probabilities: Record<ProspectStatus, number>;
}

export interface PipelineEvent {
  prospectId: string;
  stage: ProspectStatus;
  note: string | null;
  at: string; // ISO date
}

/** Funnel health snapshot (Phase 4). */
export interface FunnelSummary {
  totals: Record<ProspectStatus, number>;
  openDeals: number;
  totalValueUsd: number;
  winRate: number; // won / (won + lost), 0-1
  averageCycleDays: number;
}

/** One ranked item of the daily sales queue (Phase 5). */
export interface DailyQueueItem {
  rank: number;
  prospectId: string;
  company: string;
  contactName: string | null;
  industry: string | null;
  stage: ProspectStatus;
  score: number;
  temperature: LeadTemperature;
  acvUsd: number;
  probability: number;
  expectedRevenueUsd: number;
  urgency: number;
  /** Minutes required for this step (2 min per touch). */
  effortMinutes: number;
  message: OutreachMessage;
  followUpAt: string; // yyyy-mm-dd
}

export interface DailySalesQueue {
  date: string; // yyyy-mm-dd
  limit: number;
  items: DailyQueueItem[];
  totalEffortMinutes: number;
}

/** Follow-up decision produced by the engine (Phase 6). */
export interface FollowUpAction {
  prospectId: string;
  company: string;
  action: "first_contact" | "follow_up" | "escalate" | "stop";
  channel: ProspectMessageChannel;
  reason: string;
  dueAt: string; // ISO
  message: OutreachMessage | null;
}

/** Outbound messaging record (loaded from prospect_messages). */
export interface MessageRecord {
  prospectId: string;
  channel: ProspectMessageChannel;
  templateKey: string | null;
  status: "draft" | "sent" | "failed" | "replied";
  sentAt: string | null;
  repliedAt: string | null;
}

/** Sales analytics snapshot (Phase 7). */
export interface SalesAnalytics {
  asOf: string;
  funnel: FunnelSummary;
  contacted: number;
  replies: number;
  meetings: number;
  trials: number;
  paidCustomers: number;
  revenueUsd: number;
  mrrUsd: number;
  replyRate: number; // replies / messages sent
  winRate: number;
  averageCycleDays: number;
  forecast: {
    next30DaysUsd: number;
    next90DaysUsd: number;
  };
}

/** Top-line CEO sales briefing (Phase 9). */
export interface CeoSalesReport {
  asOf: string;
  topOpportunities: Array<{
    company: string;
    stage: ProspectStatus;
    valueUsd: number;
    probability: number;
    reason: string;
  }>;
  lostCount: number;
  biggestRisks: string[];
  highestValue: number;
  recommendations: string[];
  markdown: string;
}

/** Daily founder briefing built from queue + follow-ups (Phase 10). */
export interface SalesBriefing {
  date: string;
  queue: DailySalesQueue;
  followUps: FollowUpAction[];
  readMinutes: number; // always <= 2
  markdown: string;
}

export type { SalesProspect };

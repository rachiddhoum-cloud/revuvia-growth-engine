/**
 * Autonomous learning engine — Sprint 8, shared types.
 */

export type StrategyType =
  | "article_structure"
  | "keyword_cluster"
  | "publication_time"
  | "cta"
  | "lead_magnet"
  | "channel"
  | "outreach_pattern"
  | "backlink_source"
  | "content_type"
  | "sales_message"
  | "sales_industry"
  | "sales_channel"
  | "sales_cadence";

export interface KnowledgeMetrics {
  avgTraffic: number;
  avgLeads: number;
  avgCtr: number; // 0-1
  avgEngagement: number;
  revenueUsd: number;
}

export interface KnowledgeEntry {
  strategyType: StrategyType;
  key: string;
  confidence: number; // 0-1
  attempts: number;
  successes: number;
  failures: number;
  metrics: KnowledgeMetrics;
  upliftPct: number; // vs baseline, -100..+∞
  evidence: string[];
  learnedAt: string | null;
}

/** Success pattern detected from historical artifacts (Phase 4). */
export interface SuccessPattern {
  strategyType: StrategyType;
  key: string;
  samples: number;
  successRate: number; // 0-1
  avgTraffic: number;
  avgLeads: number;
  avgCtr: number;
  upliftPct: number; // vs baseline, -100..+∞
  evidence: string[];
}

/** Failure detected with a corrective action (Phase 5). */
export interface Failure {
  kind: "low_roi_content" | "dead_keyword" | "never_ranking" | "poor_reply_outreach";
  target: string;
  detail: string;
  severity: "low" | "medium" | "high";
  correctiveAction: string;
}

/** Confidence model attached to every recommendation (Phase 6). */
export interface ConfidenceModel {
  confidence: number; // 0-1
  expectedRoiUsd: number;
  expectedTraffic: number;
  expectedLeads: number;
  expectedRevenue: number;
  expectedMrrUsd: number;
  ice: number;
  evidence: string[];
}

/** Weekly self-improvement report (Phase 7). */
export interface LearningInsights {
  weekStart: string;
  learned: string[];
  stopDoing: string[];
  doMore: string[];
  patterns: SuccessPattern[];
  failures: Failure[];
}

/** Historical samples consumed by the pure detectors. */

export interface ArticleSample {
  slug: string;
  title: string;
  kind: "article" | "landing" | "faq" | "lead_magnet";
  ctaType: string | null;
  leadMagnetKind: string | null;
  publishedAt: string;
  traffic: number; // clicks, last 28d
  impressions: number;
  leads: number; // downloads attributed to the article
}

export interface KeywordSample {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  position: number;
}

export interface PostSample {
  platform: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  published: boolean; // external_url present / status published
}

export interface DailySample {
  date: string;
  organicVisits: number;
  clicks: number;
  conversions: number;
  leadDownloads: number;
  revenue: number;
}

export interface OutreachSample {
  pageUrl: string;
  personalized: boolean; // prospect attached
  status: "queued" | "in_progress" | "done" | "dropped";
  updatedAt: string | null;
}

export interface BacklinkSample {
  urlFrom: string;
  domainFrom: string;
  domainRating: number;
}

export interface MagnetSample {
  kind: string;
  title: string;
  downloads: number;
}

export interface CtaSample {
  ctaType: string;
  traffic: number;
  leads: number;
}

export interface QueryTrendSample {
  query: string;
  date: string; // yyyy-mm-dd
  clicks: number;
  impressions: number;
}

export interface PageTrendSample {
  url: string;
  date: string; // yyyy-mm-dd
  impressions: number;
  position: number;
}

export interface LearningSamples {
  articles: ArticleSample[];
  keywords: KeywordSample[];
  posts: PostSample[];
  daily: DailySample[];
  outreach: OutreachSample[];
  backlinks: BacklinkSample[];
  magnets: MagnetSample[];
  ctas: CtaSample[];
  queries: QueryTrendSample[];
  pages: PageTrendSample[];
}

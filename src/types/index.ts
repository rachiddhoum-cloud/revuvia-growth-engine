import type {
  KeywordIntent,
  ContentKind,
  ContentStatus,
  LeadMagnetKind,
  SocialPlatform,
  CalendarChannel,
  PipelineStage,
  PipelineStageStatus,
  ReportType,
  JobStatus,
  CustomerStatus,
  ProspectStatus,
  KnowledgeStrategyType,
  ProspectMessageChannel,
} from "@/types/supabase";

export type {
  KeywordIntent,
  ContentKind,
  ContentStatus,
  LeadMagnetKind,
  SocialPlatform,
  CalendarChannel,
  PipelineStage,
  PipelineStageStatus,
  ReportType,
  JobStatus,
  CustomerStatus,
  ProspectStatus,
  KnowledgeStrategyType,
  ProspectMessageChannel,
};

/** A keyword enriched by SEO analysis (Module 1 output). */
export interface AnalyzedKeyword {
  keyword: string;
  volume: number;
  difficulty: number; // 0-100
  intent: KeywordIntent;
  cpc: number;
  opportunityScore: number; // 0-100
  cluster: string | null;
  priority: number; // 1 = highest
  serpFeatures: SerpFeature[];
  topCompetitors: string[];
  rationale: string;
}

export type SerpFeature =
  | "featured_snippet"
  | "people_also_ask"
  | "knowledge_panel"
  | "image_pack"
  | "video"
  | "local_pack"
  | "shopping";

export interface KeywordClusterOutput {
  name: string;
  intent: KeywordIntent;
  keywords: string[];
}

/** Module 1 full output: ranked SEO opportunities. */
export interface SeoOpportunityReport {
  seedKeyword: string;
  analyzedAt: string;
  clusters: KeywordClusterOutput[];
  opportunities: AnalyzedKeyword[];
}

/** CTA config embedded in generated content. */
export interface CtaConfig {
  label: string;
  href: string;
  tone: "primary" | "secondary" | "outline";
  position: "top" | "middle" | "bottom";
}

/** Internal link suggestion. */
export interface InternalLink {
  text: string;
  url: string;
  anchor: string;
}

/** FAQ item. */
export interface FaqItem {
  question: string;
  answer: string;
}

/** Complete generated content bundle (Module 2 output). */
export interface GeneratedContent {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  bodyMarkdown: string;
  jsonLd: Record<string, unknown>;
  faqs: FaqItem[];
  internalLinks: InternalLink[];
  cta: CtaConfig;
  featuredSnippet: string;
  tags: string[];
  kind: ContentKind;
}

/** Social post transformation (Module 2 output). */
export interface SocialPostOutput {
  platform: SocialPlatform;
  body: string;
  hashtags?: string[];
}

/** Lead magnet output (Module 4). */
export interface LeadMagnetOutput {
  kind: LeadMagnetKind;
  title: string;
  description: string;
  contentMarkdown: string;
  downloadFileName: string;
}

/** Calendar generation plan (Module 3). */
export interface CalendarPlanItem {
  title: string;
  channel: CalendarChannel;
  scheduledAt: string; // ISO
  status: "idea";
}

export interface CalendarPlan {
  startDate: string;
  frequency: "daily" | "weekly" | "monthly";
  items: CalendarPlanItem[];
}

/** Content quality score (Phase 2). */
export interface QualityDimension {
  score: number; // 0-100
  label: string;
  notes: string[];
}

export interface ContentQualityResult {
  overall: number; // 0-100
  passed: boolean; // overall >= 80
  dimensions: Record<QualityDimensionKey, QualityDimension>;
  createdAt: string;
}

export type QualityDimensionKey =
  | "seoQuality"
  | "readability"
  | "originality"
  | "ctaQuality"
  | "keywordDensity"
  | "titleQuality"
  | "metaQuality"
  | "structure"
  | "aiConfidence";

/** Internal link suggestion (Phase 3). */
export interface InternalLinkSuggestion {
  targetType: "article" | "page" | "pricing" | "blog" | "landing";
  targetUrl: string;
  anchorText: string;
  contextSentence?: string;
  rationale: string;
  score: number; // 0-100 relevance
}

/** Editorial pipeline stage result (Phase 1). */
export interface PipelineStageResult {
  stage: PipelineStage;
  status: PipelineStageStatus;
  attempt: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  payload?: Record<string, unknown>;
}

export interface PipelineRunResult {
  contentItemId: string;
  stages: PipelineStageResult[];
  currentStatus: ContentStatus;
  stoppedAt: PipelineStage;
}

/** Weekly report data model (Phase 5). */
export interface WeeklyReportData {
  ownerId: string;
  periodStart: string;
  periodEnd: string;
  publishedCount: number;
  impressions: number;
  clicks: number;
  ctr: number;
  topKeywords: Array<{ keyword: string; impressions: number; clicks: number; position: number }>;
  topPages: Array<{ url: string; visits: number; clicks: number }>;
  aiProductivity: {
    runs: number;
    tokens: number;
    costUsd: number;
    modules: Record<string, number>;
  };
  recommendations: string[];
}

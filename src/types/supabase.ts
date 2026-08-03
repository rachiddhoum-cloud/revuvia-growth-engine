/**
 * Supabase database types.
 * NOTE: regenerate with `supabase gen types typescript` once the project is connected.
 * These hand-written types cover the schema in supabase/migrations/0001_init.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type KeywordIntent = "informational" | "commercial" | "transactional" | "navigational";

export type ContentKind = "article" | "landing" | "faq" | "lead_magnet";

export type LeadMagnetKind = "checklist" | "guide" | "template" | "ebook" | "worksheet" | "pdf";

export type ContentStatus =
  | "idea"
  | "keyword_research"
  | "seo_brief"
  | "draft"
  | "writing"
  | "quality"
  | "ready"
  | "approved"
  | "queued"
  | "published";

export type SocialPlatform = "linkedin" | "facebook" | "instagram" | "x" | "email" | "video" | "whatsapp";

export type CalendarChannel = "blog" | "linkedin" | "facebook" | "instagram" | "x" | "email";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  company: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeoProjectRow {
  id: string;
  owner_id: string;
  name: string;
  target_url: string | null;
  country: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeywordClusterRow {
  id: string;
  project_id: string;
  name: string;
  intent: string | null;
  created_at: string;
}

export interface KeywordRow {
  id: string;
  project_id: string;
  cluster_id: string | null;
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  intent: string | null;
  cpc: number | null;
  opportunity_score: number | null;
  priority: number | null;
  competitors: Json;
  serp: Json;
  created_at: string;
  updated_at: string;
}

export interface CompetitorRow {
  id: string;
  project_id: string;
  domain: string;
  keyword_overlap: Json;
  authority_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface ContentCategoryRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  color: string | null;
  created_at: string;
}

export interface ContentItemRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  keyword_id: string | null;
  category_id: string | null;
  cluster_id: string | null;
  brief_id: string | null;
  kind: ContentKind;
  lead_magnet_kind: LeadMagnetKind | null;
  title: string;
  slug: string;
  status: ContentStatus;
  body_markdown: string | null;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  json_ld: Json;
  faqs: Json;
  internal_links: Json;
  cta: Json;
  featured_snippet: string | null;
  cover_url: string | null;
  tags: string[] | null;
  quality_score: number | null;
  version: number;
  scheduled_for: string | null;
  published_at: string | null;
  is_lead_magnet: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ContentVersionRow {
  id: string;
  content_item_id: string;
  version: number;
  snapshot: Json;
  created_at: string;
}

export interface SocialPostRow {
  id: string;
  owner_id: string;
  content_item_id: string | null;
  platform: SocialPlatform;
  body: string;
  status: "draft" | "scheduled" | "published";
  scheduled_for: string | null;
  published_at: string | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialCredentialRow {
  id: string;
  owner_id: string;
  platform: "linkedin" | "facebook" | "x";
  access_token: string;
  refresh_token: string | null;
  account_id: string | null;
  account_name: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AhrefsBacklinkRow {
  id: string;
  owner_id: string;
  url_from: string;
  url_to: string;
  domain_from: string;
  domain_rating: number;
  anchor: string | null;
  first_seen: string | null;
  last_seen: string | null;
  created_at: string;
}

export interface AhrefsSyncLogRow {
  id: string;
  owner_id: string;
  target: string;
  status: "running" | "success" | "partial" | "failed";
  rows_upserted: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export type OutreachTaskStatus = "queued" | "in_progress" | "done" | "dropped";

export interface OutreachTaskRow {
  id: string;
  owner_id: string;
  page_url: string;
  page_title: string;
  clicks: number;
  impressions: number;
  anchor: string;
  ice: number;
  priority: "P0" | "P1" | "P2";
  expected_traffic: number;
  email_draft: string;
  reasoning: string;
  status: OutreachTaskStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type KnowledgeStrategyType =
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

export interface KnowledgeEntryRow {
  id: string;
  owner_id: string;
  strategy_type: KnowledgeStrategyType;
  key: string;
  confidence: number;
  attempts: number;
  successes: number;
  failures: number;
  metrics: Json;
  uplift_pct: number;
  evidence: Json;
  learned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEntryRow {
  id: string;
  owner_id: string;
  content_item_id: string | null;
  title: string;
  scheduled_at: string;
  channel: CalendarChannel;
  status: ContentStatus;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeadMagnetDownloadRow {
  id: string;
  content_item_id: string;
  email: string | null;
  owner_id: string | null;
  downloaded_at: string;
  user_agent: string | null;
  referrer: string | null;
}

export interface RankSnapshotRow {
  id: string;
  keyword_id: string;
  position: number | null;
  url: string | null;
  device: string | null;
  tracked_on: string;
  created_at: string;
}

export interface DailyMetricsRow {
  id: string;
  owner_id: string;
  metric_date: string;
  organic_visits: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  conversions: number | null;
  lead_downloads: number | null;
  revenue: number | null;
}

export interface PageMetricsRow {
  id: string;
  owner_id: string;
  url: string;
  visits: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  avg_position: number | null;
  updated_at: string;
}

export interface GenerationRunRow {
  id: string;
  owner_id: string | null;
  module: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  status: string | null;
  created_at: string;
}

export type PipelineStage =
  | "idea"
  | "keyword_research"
  | "seo_brief"
  | "writing"
  | "quality"
  | "approval"
  | "publish"
  | "published"
  | "performance";

export type PipelineStageStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export interface PipelineRunRow {
  id: string;
  content_item_id: string;
  stage: PipelineStage;
  status: PipelineStageStatus;
  attempt: number;
  error: string | null;
  payload: Json;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SeoBriefRow {
  id: string;
  content_item_id: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string | null;
  audience: string | null;
  competitors: string[];
  outline: string[];
  word_count_target: number;
  created_at: string;
}

export interface ContentQualityScoreRow {
  id: string;
  content_item_id: string;
  overall: number;
  seo_quality: number;
  readability: number;
  originality: number;
  cta_quality: number;
  keyword_density: number;
  title_quality: number;
  meta_quality: number;
  structure: number;
  ai_confidence: number;
  breakdown: Json;
  passed: boolean;
  model: string | null;
  created_at: string;
}

export interface InternalLinkRow {
  id: string;
  content_item_id: string;
  target_type: "article" | "page" | "pricing" | "blog" | "landing";
  target_url: string;
  anchor_text: string;
  context_sentence: string | null;
  source_ai: boolean;
  status: "active" | "broken" | "removed";
  created_at: string;
}

export type ReportType =
  | "weekly"
  | "monthly"
  | "audit"
  | "action_plan"
  | "daily_brief"
  | "ceo"
  | "linking_plan"
  | "seo_loop"
  | "lead_loop"
  | "opportunities"
  | "execution_calendar"
  | "founder_inbox"
  | "growth_score"
  | "seo_health"
  | "gsc_recommendations"
  | "outreach_plan"
  | "learning_insights"
  | "sales_pipeline"
  | "sales_queue"
  | "sales_analytics"
  | "ceo_sales"
  | "sales_briefing";

export interface ReportRow {
  id: string;
  owner_id: string;
  type: ReportType;
  period_start: string;
  period_end: string;
  markdown: string;
  html: string;
  email_html: string;
  pdf_ready: string;
  data: Json;
  status: "generated" | "sent" | "failed";
  generated_at: string;
}

export interface JobRow {
  id: string;
  owner_id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
}

export type JobStatus = "pending" | "running" | "completed" | "failed" | "retrying";

export type CustomerStatus = "lead" | "trial" | "paid" | "churned";

export interface CustomerRow {
  id: string;
  owner_id: string;
  email: string;
  company: string | null;
  industry: string | null;
  status: CustomerStatus;
  plan: string | null;
  mrr_usd: number | null;
  last_contact_at: string | null;
  created_at: string;
}

export type ProspectStatus =
  | "new"
  | "contacted"
  | "replied"
  | "demo"
  | "closed"
  | "lost"
  | "new_lead"
  | "waiting"
  | "interested"
  | "demo_scheduled"
  | "trial_started"
  | "negotiation"
  | "won"
  | "archived";

export type GscSyncStatus = "running" | "success" | "partial" | "failed";

export interface SearchConsoleCredentialRow {
  id: string;
  owner_id: string;
  site_url: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchConsoleSiteRow {
  id: string;
  owner_id: string;
  site_url: string;
  name: string | null;
  created_at: string;
}

export interface SearchConsoleQueryRow {
  id: string;
  owner_id: string;
  site_url: string;
  query: string;
  search_type: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  created_at: string;
}

export interface SearchConsolePageRow {
  id: string;
  owner_id: string;
  site_url: string;
  url: string;
  search_type: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  created_at: string;
}

export interface SearchConsoleDailyRow {
  id: string;
  owner_id: string;
  site_url: string;
  date: string;
  search_type: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pages: number;
  queries: number;
  created_at: string;
}

export interface SearchConsoleSyncLogRow {
  id: string;
  owner_id: string;
  site_url: string;
  started_at: string;
  finished_at: string | null;
  status: GscSyncStatus;
  rows_upserted: number;
  error: string | null;
  sync_window: string | null;
}

export interface ProspectRow {
  id: string;
  owner_id: string;
  company: string;
  industry: string | null;
  contact_name: string | null;
  email: string | null;
  priority_score: number | null;
  status: ProspectStatus;
  last_interaction_at: string | null;
  recommended_message: string | null;
  follow_up_at: string | null;
  probability: number | null;
  notes: string | null;
  website: string | null;
  google_maps_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  company_size: number | null;
  est_monthly_reviews: number | null;
  est_seo_score: number | null;
  est_traffic: number | null;
  est_opportunity_score: number | null;
  lead_score: number | null;
  lead_temperature: "hot" | "warm" | "cold" | null;
  acv_usd: number | null;
  created_at: string;
  updated_at: string;
}

export type ProspectMessageChannel = "email" | "linkedin" | "whatsapp" | "facebook" | "call";

export interface ProspectMessageRow {
  id: string;
  owner_id: string;
  prospect_id: string;
  channel: ProspectMessageChannel;
  template_key: string | null;
  subject: string | null;
  body: string;
  status: "draft" | "sent" | "failed" | "replied";
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface PipelineEventRow {
  id: string;
  owner_id: string;
  prospect_id: string;
  stage: ProspectStatus;
  note: string | null;
  created_at: string;
}

export interface JobRunRow {
  id: string;
  job_id: string;
  status: JobStatus;
  attempt: number;
  max_attempts: number;
  result: Json;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/**
 * Normalize a row type into a plain object shape.
 *
 * postgrest-js types `GenericTable["Row"]` as `Record<string, unknown>`.
 * A TypeScript `interface` never satisfies that constraint because interfaces
 * do not get an implicit index signature. A mapped type does. Wrapping the row
 * here keeps strict column typing while making every table assignable to
 * `GenericTable`, so `SupabaseClient<Database>` resolves `Schema` to the
 * `public` schema instead of collapsing to `never`.
 */
type Row<R> = { [K in keyof R]: R[K] };

/** Minimal table definition shape expected by postgrest-js. */
type T<R> = { Row: Row<R>; Insert: Partial<Row<R>>; Update: Partial<Row<R>>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: T<ProfileRow>;
      seo_projects: T<SeoProjectRow>;
      keyword_clusters: T<KeywordClusterRow>;
      keywords: T<KeywordRow>;
      competitors: T<CompetitorRow>;
      content_categories: T<ContentCategoryRow>;
      content_items: T<ContentItemRow>;
      content_versions: T<ContentVersionRow>;
      social_posts: T<SocialPostRow>;
      calendar_entries: T<CalendarEntryRow>;
      lead_magnet_downloads: T<LeadMagnetDownloadRow>;
      rank_snapshots: T<RankSnapshotRow>;
      daily_metrics: T<DailyMetricsRow>;
      page_metrics: T<PageMetricsRow>;
      generation_runs: T<GenerationRunRow>;
      pipeline_runs: T<PipelineRunRow>;
      seo_briefs: T<SeoBriefRow>;
      content_quality_scores: T<ContentQualityScoreRow>;
      internal_links: T<InternalLinkRow>;
      reports: T<ReportRow>;
      jobs: T<JobRow>;
      job_runs: T<JobRunRow>;
      customers: T<CustomerRow>;
      prospects: T<ProspectRow>;
      search_console_credentials: T<SearchConsoleCredentialRow>;
      search_console_sites: T<SearchConsoleSiteRow>;
      search_console_queries: T<SearchConsoleQueryRow>;
      search_console_pages: T<SearchConsolePageRow>;
      search_console_daily_metrics: T<SearchConsoleDailyRow>;
      search_console_sync_logs: T<SearchConsoleSyncLogRow>;
      social_credentials: T<SocialCredentialRow>;
      ahrefs_backlinks: T<AhrefsBacklinkRow>;
      ahrefs_sync_logs: T<AhrefsSyncLogRow>;
      outreach_tasks: T<OutreachTaskRow>;
      knowledge_base: T<KnowledgeEntryRow>;
      pipeline_events: T<PipelineEventRow>;
      prospect_messages: T<ProspectMessageRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

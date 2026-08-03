/**
 * Growth Operating System — Sprint 3 barrel.
 */

export { iceScore, priorityFromIce, formatIce, estimateMrrImpact } from "@/lib/ops/ice";
export {
  buildGrowthSnapshot,
  aggregateWeekly,
  estimateSeoTraffic,
  weekWindow,
} from "@/lib/ops/snapshot";
export type { SnapshotInput } from "@/lib/ops/snapshot";
export {
  buildActionPlan,
  contentToAction,
  seoToAction,
  salesToAction,
} from "@/lib/ops/plan";
export type { PlanInput } from "@/lib/ops/plan";
export {
  buildSalesPlan,
  scoreProspect,
  expectedProbability,
  industryMessage,
  followUpDate,
} from "@/lib/ops/sales";
export type { SalesInput } from "@/lib/ops/sales";
export {
  buildSeoMissions,
  quickWins,
  findTrafficLosses,
  findUnderLinkedPages,
  findKeywordAttacks,
  findCompetitorGaps,
} from "@/lib/ops/seo-missions";
export type { MissionInput } from "@/lib/ops/seo-missions";
export {
  buildContentQueue,
  rankContentQueue,
  defaultCandidates,
  estimateAiCost,
  AI_COST_PER_1K_WORDS,
} from "@/lib/ops/content-queue";
export type { ContentCandidate } from "@/lib/ops/content-queue";
export {
  buildDailyBrief,
  briefToMarkdown,
  todaysPriorities,
  newOpportunities,
  urgentIssues,
} from "@/lib/ops/brief";
export type { BriefInput } from "@/lib/ops/brief";
export {
  buildCeoReport,
  ceoReportToMarkdown,
  ceoReportToHtml,
  renderCeoReport,
  humanDate,
} from "@/lib/ops/ceo-report";
export type { CeoReportInput, CeoReportRender } from "@/lib/ops/ceo-report";
export {
  schedulePublishing,
  draftForPlatform,
  dueSlots,
  markPublished,
  publishableArticles,
  addDays,
  todayLocal,
  SOCIAL_PLATFORMS,
} from "@/lib/ops/publishing";
export type { PublishingOptions, ScheduleResult } from "@/lib/ops/publishing";
export { analyzeInternalLinks, keywordTokens, sharedTokens } from "@/lib/ops/linking";
export {
  buildSeoOptimizationPlan,
  findDecliningPages,
  risingCompetitors,
  keywordGaps,
} from "@/lib/ops/seo-loop";
export type { PageTrend, CompetitorSignal, SeoLoopInput } from "@/lib/ops/seo-loop";
export {
  buildLeadGenerationPlan,
  generateLeadMagnets,
  landingPageIdeas,
  ctaImprovements,
  emailSequences,
  MAGNET_FORMATS,
} from "@/lib/ops/lead-loop";
export type { MagnetIdea, MagnetFormat, LeadLoopInput } from "@/lib/ops/lead-loop";
export {
  buildOpportunities,
  seasonalOpportunities,
  trendingOpportunities,
  localOpportunities,
  competitorWeaknessOpportunities,
} from "@/lib/ops/opportunities";
export type {
  TrendingQuery,
  CompetitorWeaknessSignal,
  OpportunityInput,
} from "@/lib/ops/opportunities";
export { buildExecutionCalendar } from "@/lib/ops/calendar";
export type { CalendarInput } from "@/lib/ops/calendar";
export { buildFounderInbox, todaysTopFive, effortMinutes } from "@/lib/ops/inbox";
export type { InboxInput } from "@/lib/ops/inbox";
export {
  buildGrowthScore,
  seoDimension,
  contentDimension,
  trafficDimension,
  leadsDimension,
  conversionDimension,
  revenueDimension,
  executionDimension,
  WEIGHTS,
} from "@/lib/ops/growth-score";
export type { GrowthScoreInput } from "@/lib/ops/growth-score";
export type {
  ActionPlan,
  ActionPriority,
  ActionKind,
  ScoredAction,
  ContentIdea,
  SeoMission,
  SalesProspect,
  DailyBrief,
  CeoReportData,
  GrowthSnapshot,
  WeeklyMetrics,
  ArticleRef,
  PublishPlatform,
  PublishingSlot,
  PublishingPlan,
  LinkingSuggestion,
  InternalLinkingPlan,
  SeoTaskSource,
  SeoOptimizationTask,
  SeoOptimizationPlan,
  LeadItemKind,
  LeadGenerationItem,
  LeadGenerationPlan,
  OpportunityKind,
  Opportunity,
  OpportunityScan,
  CalendarHorizon,
  CalendarTask,
  ExecutionCalendar,
  InboxPriority,
  FounderInbox,
  ScoreDimension,
  GrowthScoreDimensions,
  GrowthScore,
} from "@/lib/ops/types";

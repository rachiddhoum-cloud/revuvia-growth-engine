/**
 * Commercialization OS — server orchestrator (Phases 8-10).
 *
 * `runSalesDaily` — every weekday: builds the top-20 daily queue, computes
 * today's follow-up actions and emits the 2-minute founder briefing.
 * `runSalesAnalytics` — weekly: computes sales analytics, the CEO one-page
 * report, and feeds the shared knowledge_base (sales_message, sales_channel,
 * sales_industry, sales_cadence) through the learning memory model.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import type { CustomerRow, Json, ProspectMessageChannel, ProspectRow, ReportType } from "@/types/supabase";
import { todayLocal } from "@/lib/ops/publishing";
import { toKnowledgeEntry } from "@/lib/learning/server";
import { applyObservation, newEntry } from "@/lib/learning/memory";
import { buildDailyQueue } from "@/lib/sales/queue";
import { followUpActions } from "@/lib/sales/followup";
import { buildSalesAnalytics } from "@/lib/sales/analytics";
import { buildCeoSalesReport } from "@/lib/sales/ceo";
import { detectSalesPatterns } from "@/lib/sales/learning";
import type {
  DailyQueueItem,
  DailySalesQueue,
  FollowUpAction,
  MessageRecord,
  PipelineEvent,
  SalesAnalytics,
  SalesBriefing,
} from "@/lib/sales/types";

export interface SalesData {
  prospects: ProspectRow[];
  customers: CustomerRow[];
  messages: MessageRecord[];
  events: PipelineEvent[];
}

async function persistReport(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  type: ReportType,
  periodStart: string,
  periodEnd: string,
  markdown: string,
  data: unknown
): Promise<void> {
  const { error } = await sb.from("reports").upsert(
    {
      owner_id: ownerId,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      markdown,
      html: `<pre>${markdown.replace(/</g, "&lt;")}</pre>`,
      email_html: "",
      pdf_ready: "",
      data: data as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );
  if (error) throw new Error(`Failed to persist ${type}: ${error.message}`);
}

async function loadSalesData(sb: ReturnType<typeof createServiceRoleClient>, ownerId: string): Promise<SalesData> {
  const [prospectRows, customerRows, messageRows, eventRows] = await Promise.all([
    sb.from("prospects").select("*").eq("owner_id", ownerId),
    sb.from("customers").select("*").eq("owner_id", ownerId),
    sb.from("prospect_messages").select("prospect_id,channel,template_key,status,sent_at,replied_at").eq("owner_id", ownerId),
    sb.from("pipeline_events").select("prospect_id,stage,note,created_at").eq("owner_id", ownerId),
  ]);
  for (const [label, r] of [
    ["prospects", prospectRows],
    ["customers", customerRows],
    ["messages", messageRows],
    ["pipeline events", eventRows],
  ] as const) {
    if (r.error) throw new Error(`Failed to load ${label}: ${r.error.message}`);
  }

  return {
    prospects: prospectRows.data ?? [],
    customers: customerRows.data ?? [],
    messages: (messageRows.data ?? []).map((m) => ({
      prospectId: m.prospect_id,
      channel: m.channel as ProspectMessageChannel,
      templateKey: m.template_key,
      status: m.status as MessageRecord["status"],
      sentAt: m.sent_at,
      repliedAt: m.replied_at,
    })),
    events: (eventRows.data ?? []).map((e) => ({
      prospectId: e.prospect_id,
      stage: e.stage,
      note: e.note,
      at: e.created_at,
    })),
  };
}

/** Phase 10: the ≤2-minute founder briefing from queue + follow-ups. */
export function buildSalesBriefing(date: string, queue: DailySalesQueue, followUps: FollowUpAction[]): SalesBriefing {
  const actionable = followUps.filter((f) => f.action === "first_contact" || f.action === "follow_up" || f.action === "escalate");
  const urgent = followUps.filter((f) => f.action === "escalate").map((f) => f.company);
  const top3: DailyQueueItem[] = queue.items.slice(0, 3);

  const markdown = [
    `# Sales Briefing — ${date}`,
    "",
    `## Today's queue (${queue.items.length} prospects, ~${queue.totalEffortMinutes} min)`,
    ...top3.map(
      (i) => `- ${i.rank}. ${i.company} (${i.stage}) — $${i.expectedRevenueUsd} expected · ${i.message.channel} · follow-up ${i.followUpAt}`
    ),
    ...(queue.items.length > 3 ? [`- … plus ${queue.items.length - 3} more (${queue.limit} max)`] : []),
    "",
    `## Follow-ups due (${actionable.length})`,
    ...(actionable.length > 0
      ? actionable.slice(0, 5).map((f) => `- ${f.company}: ${f.action.replace("_", " ")} (${f.channel}) — ${f.reason}`)
      : ["- None today"]),
    "",
    "## Urgent",
    ...(urgent.length > 0 ? [`- Escalate to phone: ${urgent.join(", ")}`] : ["- Nothing urgent"]),
    "",
    "_Read in ≤ 2 minutes._",
  ].join("\n");

  return { date, queue, followUps, readMinutes: 2, markdown };
}

/** Weekday (or on-demand) cron: run the daily sales workflow. */
export async function runSalesDaily(
  ownerId = "system",
  opts: { date?: string; now?: Date } = {}
): Promise<{
  ok: boolean;
  queue: DailySalesQueue;
  followUps: FollowUpAction[];
  briefing: SalesBriefing;
  artifacts: Record<string, unknown>;
}> {
  const sb = createServiceRoleClient();
  const now = opts.now ?? new Date();
  const date = opts.date ?? todayLocal();

  const { prospects, messages } = await loadSalesData(sb, ownerId);

  const queue = buildDailyQueue({ prospects, date, limit: 20, now });
  const followUps = followUpActions({ prospects, messages, now });
  const briefing = buildSalesBriefing(date, queue, followUps);

  await persistReport(sb, ownerId, "sales_queue", date, date, briefing.markdown, {
    queue,
    generatedAt: now.toISOString(),
  });
  await persistReport(sb, ownerId, "sales_briefing", date, date, briefing.markdown, {
    briefing,
    generatedAt: now.toISOString(),
  });

  return {
    ok: true,
    queue,
    followUps,
    briefing,
    artifacts: {
      date,
      queueSize: queue.items.length,
      effortMinutes: queue.totalEffortMinutes,
      followUpsDue: followUps.length,
      firstContacts: followUps.filter((f) => f.action === "first_contact").length,
      escalations: followUps.filter((f) => f.action === "escalate").length,
      stops: followUps.filter((f) => f.action === "stop").length,
    },
  };
}

/** Weekly (or on-demand) cron: analytics + CEO report + sales learning. */
export async function runSalesAnalytics(
  ownerId = "system",
  opts: { asOf?: Date } = {}
): Promise<{
  ok: boolean;
  analytics: SalesAnalytics;
  ceo: ReturnType<typeof buildCeoSalesReport>;
  patterns: ReturnType<typeof detectSalesPatterns>;
  artifacts: Record<string, unknown>;
}> {
  const sb = createServiceRoleClient();
  const asOf = opts.asOf ?? new Date();
  const today = todayLocal();

  const { prospects, customers, messages, events } = await loadSalesData(sb, ownerId);

  const analytics = buildSalesAnalytics({ prospects, customers, messages, events, asOf });
  const ceo = buildCeoSalesReport({ analytics, prospects, messages, events, asOf });
  const patterns = detectSalesPatterns(prospects, messages);

  const { data: existingRows } = await sb
    .from("knowledge_base")
    .select("strategy_type,key,confidence,attempts,successes,failures,metrics,uplift_pct,evidence,learned_at")
    .eq("owner_id", ownerId);
  if (existingRows === null) throw new Error("Failed to load knowledge base");

  const byKey = new Map<string, ReturnType<typeof toKnowledgeEntry>>();
  for (const row of existingRows) byKey.set(`${row.strategy_type}:${row.key}`, toKnowledgeEntry(row));

  let knowledgeUpdated = 0;
  for (const pattern of patterns) {
    const compositeKey = `${pattern.strategyType}:${pattern.key}`;
    const entry = byKey.get(compositeKey) ?? newEntry(pattern.strategyType, pattern.key);
    const updatedEntry = applyObservation(entry, {
      metrics: {
        avgTraffic: 0,
        avgLeads: pattern.attempts,
        avgCtr: 0,
        avgEngagement: pattern.successRate,
        revenueUsd: 0,
      },
      outcome: pattern.outcome,
      evidence: pattern.evidence,
      upliftPct: pattern.upliftPct,
    });
    const { error } = await sb.from("knowledge_base").upsert(
      {
        owner_id: ownerId,
        strategy_type: updatedEntry.strategyType,
        key: updatedEntry.key,
        confidence: updatedEntry.confidence,
        attempts: updatedEntry.attempts,
        successes: updatedEntry.successes,
        failures: updatedEntry.failures,
        metrics: updatedEntry.metrics as unknown as Json,
        uplift_pct: updatedEntry.upliftPct,
        evidence: updatedEntry.evidence as unknown as Json,
        learned_at: updatedEntry.learnedAt,
      },
      { onConflict: "owner_id,strategy_type,key" }
    );
    if (error) throw new Error(`Failed to persist knowledge: ${error.message}`);
    byKey.set(compositeKey, updatedEntry);
    knowledgeUpdated += 1;
  }

  await persistReport(sb, ownerId, "sales_analytics", today, today, ceo.markdown, {
    analytics,
    generatedAt: asOf.toISOString(),
  });
  await persistReport(sb, ownerId, "ceo_sales", today, today, ceo.markdown, {
    ceo,
    patterns,
    generatedAt: asOf.toISOString(),
  });

  return {
    ok: true,
    analytics,
    ceo,
    patterns,
    artifacts: {
      date: today,
      openDeals: analytics.funnel.openDeals,
      mrrUsd: analytics.mrrUsd,
      forecast30: analytics.forecast.next30DaysUsd,
      winRate: analytics.winRate,
      patternsFound: patterns.length,
      knowledgeUpdated,
      topDeal: ceo.topOpportunities[0]?.company ?? null,
      risks: ceo.biggestRisks.length,
    },
  };
}

/**
 * Phase 4 — Customer journey tracking + funnel visualization.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import type { FunnelStage, JourneyStage } from "@/lib/acquisition/types";
import type { Json } from "@/types/supabase";

const STAGE_ORDER: JourneyStage[] = [
  "anonymous",
  "lead",
  "registered",
  "trial",
  "paid",
  "cancelled",
  "recovered",
];

const STAGE_LABELS: Record<JourneyStage, string> = {
  anonymous: "Anonymous visitor",
  lead: "Lead captured",
  registered: "Registered user",
  trial: "Trial started",
  paid: "Paid customer",
  cancelled: "Cancelled",
  recovered: "Recovered",
};

export interface JourneyEventInput {
  ownerId?: string;
  stage: JourneyStage;
  visitorId?: string;
  leadId?: string;
  email?: string;
  channel?: string;
  contentItemId?: string;
  ctaId?: string;
  revenueUsd?: number;
  metadata?: Record<string, unknown>;
}

export async function recordJourneyEvent(input: JourneyEventInput): Promise<void> {
  const owner = resolveOwnerId(input.ownerId);
  const sb = createServiceRoleClient();

  const { error } = await sb.from("journey_events").insert({
    owner_id: owner,
    visitor_id: input.visitorId ?? null,
    lead_id: input.leadId ?? null,
    email: input.email ?? null,
    stage: input.stage,
    channel: input.channel ?? null,
    content_item_id: input.contentItemId ?? null,
    cta_id: input.ctaId ?? null,
    revenue_usd: input.revenueUsd ?? 0,
    metadata: (input.metadata ?? {}) as Json,
  });

  if (error) console.error("[cas] journey event failed", error);
}

export interface JourneyFunnelModel {
  stages: FunnelStage[];
  totalEvents: number;
  recentEvents: {
    stage: JourneyStage;
    email: string | null;
    channel: string | null;
    occurredAt: string;
  }[];
}

export async function loadJourneyFunnel(ownerId?: string, days = 30): Promise<JourneyFunnelModel> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const [{ data: events }, { data: recent }] = await Promise.all([
    sb.from("journey_events").select("stage").eq("owner_id", owner).gte("occurred_at", since),
    sb
      .from("journey_events")
      .select("stage, email, channel, occurred_at")
      .eq("owner_id", owner)
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);

  const counts = new Map<JourneyStage, number>();
  for (const stage of STAGE_ORDER) counts.set(stage, 0);
  for (const e of events ?? []) {
    const s = e.stage as JourneyStage;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const anonymousCount = counts.get("anonymous") ?? 0;
  const stages: FunnelStage[] = STAGE_ORDER.map((stage, i) => {
    const count = counts.get(stage) ?? 0;
    const prev = i > 0 ? (counts.get(STAGE_ORDER[i - 1]) ?? 0) : anonymousCount;
    const conversionRate = prev > 0 ? Math.round((count / prev) * 1000) / 10 : 0;
    return { stage, label: STAGE_LABELS[stage], count, conversionRate };
  });

  return {
    stages,
    totalEvents: events?.length ?? 0,
    recentEvents: (recent ?? []).map((r) => ({
      stage: r.stage as JourneyStage,
      email: r.email,
      channel: r.channel,
      occurredAt: r.occurred_at,
    })),
  };
}

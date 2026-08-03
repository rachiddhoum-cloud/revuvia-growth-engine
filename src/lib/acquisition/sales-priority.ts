/**
 * Phase 6 — Sales intelligence: prioritize prospects with ICE + MRR potential.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { scoreProspectLead } from "@/lib/sales/scoring";
import { buildFirstTouchEmail } from "@/lib/sales/outreach";
import type { SalesPriorityRow } from "@/lib/acquisition/types";
import type { ProspectRow } from "@/types/supabase";

const REVUVIA_MRR_USD = 39;

export async function loadSalesPriorities(ownerId?: string, limit = 25): Promise<SalesPriorityRow[]> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();

  const { data: prospects, error } = await sb
    .from("prospects")
    .select("*")
    .eq("owner_id", owner)
    .not("status", "in", '("won","lost","closed")')
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const rows: SalesPriorityRow[] = (prospects ?? []).map((p) => toPriorityRow(p as ProspectRow));
  rows.sort((a, b) => b.iceScore - a.iceScore || b.potentialMrrUsd - a.potentialMrrUsd);
  return rows.slice(0, limit);
}

function toPriorityRow(p: ProspectRow): SalesPriorityRow {
  const scored = scoreProspectLead(p);
  const potentialMrrUsd = Math.round((scored.revenuePotential / 100) * REVUVIA_MRR_USD * 3);
  const iceScore = scored.ice;
  const closeProbability = Math.round(scored.probability * 100);
  const channel = recommendChannel(p, scored.temperature);
  const messagePreview = buildFirstTouchEmail(p).body.slice(0, 160);

  return {
    id: p.id,
    name: p.contact_name ?? p.company ?? "Prospect",
    company: p.company,
    email: p.email,
    stage: p.status,
    potentialMrrUsd,
    iceScore,
    closeProbability,
    recommendedChannel: channel,
    messagePreview,
  };
}

function recommendChannel(
  p: ProspectRow,
  temperature: "hot" | "warm" | "cold"
): string {
  if (p.phone && temperature === "hot") return "whatsapp";
  if (p.email) return "email";
  if (p.instagram_url) return "instagram";
  if (p.linkedin_url) return "linkedin";
  return "email";
}

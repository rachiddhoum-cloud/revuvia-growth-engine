/**
 * Phase 2 — Lead capture + CTA tracking.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import type { JourneyStage, LeadStatus } from "@/lib/acquisition/types";
import { recordJourneyEvent } from "@/lib/acquisition/journey";

export interface CaptureLeadInput {
  email: string;
  fullName?: string;
  company?: string;
  phone?: string;
  source?: string;
  contentItemId?: string;
  ctaId?: string;
  keywordId?: string;
  visitorId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

export interface CtaEventInput {
  ctaId?: string;
  contentItemId?: string;
  eventType: "impression" | "click" | "conversion";
  visitorId?: string;
  email?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidLeadEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

/** Capture a lead from public content CTAs or lead magnets. */
export async function captureLead(input: CaptureLeadInput, ownerId?: string): Promise<{ id: string }> {
  const owner = resolveOwnerId(ownerId);
  const email = input.email.trim().toLowerCase();
  if (!isValidLeadEmail(email)) {
    throw new Error("Invalid email");
  }

  const sb = createServiceRoleClient();

  const { data: existing } = await sb
    .from("acquisition_leads")
    .select("id, status")
    .eq("owner_id", owner)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await sb
      .from("acquisition_leads")
      .update({
        full_name: input.fullName ?? undefined,
        company: input.company ?? undefined,
        phone: input.phone ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return { id: existing.id };
  }

  const { data, error } = await sb
    .from("acquisition_leads")
    .insert({
      owner_id: owner,
      email,
      full_name: input.fullName ?? null,
      company: input.company ?? null,
      phone: input.phone ?? null,
      source: input.source ?? "content",
      content_item_id: input.contentItemId ?? null,
      cta_id: input.ctaId ?? null,
      keyword_id: input.keywordId ?? null,
      visitor_id: input.visitorId ?? null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      referrer: input.referrer ?? null,
      status: "new" as LeadStatus,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Lead insert failed");

  await recordJourneyEvent({
    ownerId: owner,
    stage: "lead",
    email,
    leadId: data.id,
    visitorId: input.visitorId,
    contentItemId: input.contentItemId,
    ctaId: input.ctaId,
    channel: input.source ?? "content",
  });

  await enrollDefaultNurture(sb, owner, data.id);

  return { id: data.id };
}

/** Track CTA impression / click / conversion. */
export async function trackCtaEvent(input: CtaEventInput, ownerId?: string): Promise<void> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();

  const { error } = await sb.from("cta_conversions").insert({
    owner_id: owner,
    cta_id: input.ctaId ?? null,
    content_item_id: input.contentItemId ?? null,
    event_type: input.eventType,
    visitor_id: input.visitorId ?? null,
    email: input.email ?? null,
    referrer: input.referrer ?? null,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
  });

  if (error) throw new Error(error.message);

  if (input.eventType === "click" && input.visitorId) {
    await recordJourneyEvent({
      ownerId: owner,
      stage: "anonymous",
      visitorId: input.visitorId,
      contentItemId: input.contentItemId,
      ctaId: input.ctaId,
      channel: "cta_click",
      metadata: { event: "cta_click" },
    });
  }
}

async function enrollDefaultNurture(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  leadId: string
): Promise<void> {
  const { data: sequence } = await sb
    .from("nurture_sequences")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("trigger", "lead_capture")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!sequence) return;

  const { data: firstStep } = await sb
    .from("nurture_steps")
    .select("step_order, delay_hours")
    .eq("sequence_id", sequence.id)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const delayMs = (firstStep?.delay_hours ?? 0) * 3600_000;
  const nextSendAt = new Date(Date.now() + delayMs).toISOString();

  await sb.from("nurture_enrollments").upsert(
    {
      owner_id: ownerId,
      sequence_id: sequence.id,
      lead_id: leadId,
      current_step: 0,
      status: "active",
      next_send_at: nextSendAt,
    },
    { onConflict: "sequence_id,lead_id", ignoreDuplicates: true }
  );

  await sb.from("acquisition_leads").update({ status: "nurturing" }).eq("id", leadId);
}

/** Load CTAs for a content item (public embed). */
export async function loadContentCtas(contentItemId: string, ownerId?: string) {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("content_ctas")
    .select("id, label, cta_type, destination_url, position, is_primary, sort_order")
    .eq("owner_id", owner)
    .eq("content_item_id", contentItemId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type { JourneyStage };

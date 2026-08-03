/**
 * Phase 3 — Nurture email sequences (send + metrics).
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";

export interface NurtureMetrics {
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
}

/** Process due nurture enrollments (daily cron). */
export async function runNurtureCycle(ownerId?: string): Promise<{ processed: number; sent: number }> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: due, error } = await sb
    .from("nurture_enrollments")
    .select("id, sequence_id, lead_id, current_step")
    .eq("owner_id", owner)
    .eq("status", "active")
    .lte("next_send_at", now)
    .limit(50);

  if (error) throw new Error(error.message);

  let sent = 0;
  for (const enrollment of due ?? []) {
    const nextStep = enrollment.current_step + 1;
    const { data: step } = await sb
      .from("nurture_steps")
      .select("id, step_order, delay_hours, subject, body_markdown, template_key")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", nextStep)
      .maybeSingle();

    if (!step) {
      await sb
        .from("nurture_enrollments")
        .update({ status: "completed", completed_at: now })
        .eq("id", enrollment.id);
      continue;
    }

    const { data: lead } = await sb
      .from("acquisition_leads")
      .select("email, status")
      .eq("id", enrollment.lead_id)
      .maybeSingle();

    if (!lead || lead.status === "unsubscribed") {
      await sb.from("nurture_enrollments").update({ status: "unsubscribed" }).eq("id", enrollment.id);
      continue;
    }

    const delivered = await deliverNurtureEmail(lead.email, step.subject, step.body_markdown);

    await sb.from("nurture_events").insert({
      owner_id: owner,
      enrollment_id: enrollment.id,
      step_id: step.id,
      event_type: delivered ? "sent" : "failed",
      metadata: { template_key: step.template_key },
    });

    if (delivered) sent += 1;

    const { data: followingStep } = await sb
      .from("nurture_steps")
      .select("step_order, delay_hours")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", nextStep + 1)
      .maybeSingle();

    const nextSendAt = followingStep
      ? new Date(Date.now() + followingStep.delay_hours * 3600_000).toISOString()
      : null;

    await sb
      .from("nurture_enrollments")
      .update({
        current_step: nextStep,
        next_send_at: nextSendAt,
        status: followingStep ? "active" : "completed",
        completed_at: followingStep ? null : now,
      })
      .eq("id", enrollment.id);
  }

  return { processed: due?.length ?? 0, sent };
}

async function deliverNurtureEmail(to: string, subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[cas] nurture email (dry-run)", { to, subject });
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NURTURE_FROM_EMAIL ?? "Revuvia <hello@revuvia.com>",
        to: [to],
        subject,
        text: body,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[cas] nurture send failed", err);
    return false;
  }
}

export async function loadNurtureMetrics(ownerId?: string, days = 30): Promise<NurtureMetrics> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data: events } = await sb
    .from("nurture_events")
    .select("event_type")
    .eq("owner_id", owner)
    .gte("created_at", since);

  const counts = { sent: 0, open: 0, click: 0, conversion: 0, unsubscribe: 0 };
  for (const e of events ?? []) {
    const t = e.event_type as keyof typeof counts;
    if (t in counts) counts[t] += 1;
  }

  const sent = counts.sent || 1;
  return {
    sent: counts.sent,
    opens: counts.open,
    clicks: counts.click,
    conversions: counts.conversion,
    unsubscribes: counts.unsubscribe,
    openRate: Math.round((counts.open / sent) * 1000) / 10,
    clickRate: Math.round((counts.click / sent) * 1000) / 10,
    unsubscribeRate: Math.round((counts.unsubscribe / sent) * 1000) / 10,
  };
}

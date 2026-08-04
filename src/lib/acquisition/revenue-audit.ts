/**
 * Revenue Operations — daily audit + founder report data (no UI).
 * Pure server logic: KPIs, blockers, ICE actions, dormant outreach drafts.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import type {
  DormantOutreach,
  IceAction,
  MetricBlocker,
  RevenueAuditResult,
  RevenueAuditKpis,
} from "@/lib/acquisition/types";

const AVG_MRR_USD = 19;
const TRIAL_TO_PAID_RATE = 0.1;

const INTERNAL_EMAIL_RE =
  /rachiddhoum|revuvia\.ops\.smoke|revuvia-e2e|cas-smoke-test|@revuvia\.com$/i;

function isInternalEmail(email: string): boolean {
  return INTERNAL_EMAIL_RE.test(email);
}

function iceScore(impact: number, confidence: number, ease: number): number {
  return impact * confidence * ease;
}

/** Lignes Revuvia — base partagée, colonnes absentes des types GE générés. */
type RevuviaBillingRow = {
  user_id: string;
  status: string | null;
  access_granted: boolean | null;
  dunning_started_at: string | null;
  cancelled_at: string | null;
};

type RevuviaProfileRow = {
  id: string;
  created_at: string;
  trial_started_at: string | null;
};

async function loadRevuviaBilling(
  sb: ReturnType<typeof createServiceRoleClient>
): Promise<RevuviaBillingRow[]> {
  const raw = sb as unknown as {
    from: (table: string) => {
      select: (columns: string) => Promise<{ data: RevuviaBillingRow[] | null; error: { message: string } | null }>;
    };
  };
  const { data, error } = await raw.from("billing_subscriptions").select(
    "user_id, status, access_granted, dunning_started_at, cancelled_at"
  );
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadRevuviaProfiles(
  sb: ReturnType<typeof createServiceRoleClient>,
  userIds: string[]
): Promise<RevuviaProfileRow[]> {
  if (userIds.length === 0) return [];
  const raw = sb as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (col: string, ids: string[]) => Promise<{ data: RevuviaProfileRow[] | null; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await raw
    .from("profiles")
    .select("id, created_at, trial_started_at")
    .in("id", userIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function countRevuviaTrials(
  sb: ReturnType<typeof createServiceRoleClient>,
  since?: string
): Promise<number> {
  const raw = sb as unknown as {
    from: (table: string) => {
      select: (columns: string) => Promise<{
        data: { trial_started_at: string | null }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data, error } = await raw.from("profiles").select("trial_started_at");
  if (error) throw new Error(error.message);
  const active = (data ?? []).filter((r) => r.trial_started_at);
  if (!since) return active.length;
  return active.filter((r) => r.trial_started_at! >= since).length;
}

function todayBounds(now: Date): { start: string; end: string; date: string } {
  const date = now.toISOString().slice(0, 10);
  return {
    date,
    start: `${date}T00:00:00.000Z`,
    end: now.toISOString(),
  };
}

function daysSince(iso: string, now: Date): number {
  const ms = now.getTime() - Date.parse(iso);
  return Math.max(0, Math.floor(ms / 86400_000));
}

function firstName(email: string): string {
  const local = email.split("@")[0] ?? "there";
  return local.split(/[.+_-]/)[0] ?? local;
}

export function buildDormantOutreach(email: string, signedUpAt: string, now: Date): DormantOutreach {
  const name = firstName(email);
  const dormantDays = daysSince(signedUpAt, now);

  return {
    email,
    signedUpAt,
    daysDormant: dormantDays,
    emailDraft: [
      `Objet : Votre compte Revuvia vous attend — essai Pro 14 jours`,
      ``,
      `Bonjour ${name},`,
      ``,
      `Vous avez créé un compte Revuvia il y a ${dormantDays} jour(s) mais l'essai Pro n'a pas encore démarré.`,
      `En 5 minutes : ajoutez votre lien Google, téléchargez votre QR, recevez vos premiers avis.`,
      ``,
      `→ Reconnectez-vous : https://revuvia.com/login`,
      `→ Besoin d'aide ? Répondez à cet email ou WhatsApp : +212 6XX XXX XXX`,
      ``,
      `Rachid — Fondateur, Revuvia`,
    ].join("\n"),
    whatsAppDraft: [
      `Salam ${name} 👋`,
      `C'est Rachid (Revuvia). Vous vous êtes inscrit il y a ${dormantDays}j — votre essai Pro 14j n'a pas encore démarré.`,
      `Je peux vous aider à configurer votre QR avis Google en 5 min ?`,
      `https://revuvia.com/login`,
    ].join("\n"),
    followUpDraft: `J+2 si pas de réponse : « ${name}, toujours intéressé par plus d'avis Google pour votre commerce ? Je vous montre le QR en 5 min au téléphone. »`,
  };
}

function blockerForMetric(
  metric: string,
  value: number,
  blocker: string,
  why: string,
  lostMrrUsd: number,
  action: string,
  ice: { impact: number; confidence: number; ease: number }
): MetricBlocker {
  return {
    metric,
    value,
    blocker,
    why,
    lostMrrUsd,
    action,
    ice: { ...ice, score: iceScore(ice.impact, ice.confidence, ice.ease) },
  };
}

/** Charge les KPIs revenue du jour depuis Supabase (Revuvia + CAS). */
export async function runRevenueAudit(ownerId?: string, now = new Date()): Promise<RevenueAuditResult> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const { date, start, end } = todayBounds(now);

  const [
    dailyMetrics,
    ctaToday,
    ctaAll,
    leadsToday,
    realLeads,
    enrollments,
    nurtureToday,
    nurtureAll,
    trialsToday,
    trialsTotal,
    billingRows,
    pendingNurture,
  ] = await Promise.all([
    sb
      .from("daily_metrics")
      .select("organic_visits, clicks, impressions")
      .eq("metric_date", date)
      .maybeSingle(),
    sb
      .from("cta_conversions")
      .select("event_type")
      .eq("owner_id", owner)
      .gte("created_at", start)
      .lte("created_at", end),
    sb.from("cta_conversions").select("event_type").eq("owner_id", owner),
    sb
      .from("acquisition_leads")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner)
      .gte("created_at", start),
    sb
      .from("acquisition_leads")
      .select("email")
      .eq("owner_id", owner)
      .not("email", "ilike", "%smoke%")
      .not("email", "ilike", "%test%"),
    sb
      .from("nurture_enrollments")
      .select("id, lead_id, current_step, next_send_at, status")
      .eq("owner_id", owner)
      .eq("status", "active"),
    sb
      .from("nurture_events")
      .select("event_type")
      .eq("owner_id", owner)
      .gte("created_at", start),
    sb.from("nurture_events").select("event_type").eq("owner_id", owner),
    countRevuviaTrials(sb, start),
    countRevuviaTrials(sb),
    loadRevuviaBilling(sb),
    sb
      .from("nurture_enrollments")
      .select("id, current_step, next_send_at, lead_id")
      .eq("owner_id", owner)
      .eq("status", "active")
      .lte("next_send_at", end),
  ]);

  const leadIds = (pendingNurture.data ?? []).map((r) => r.lead_id).filter(Boolean) as string[];
  const { data: leadEmails } =
    leadIds.length > 0
      ? await sb.from("acquisition_leads").select("id, email").in("id", leadIds)
      : { data: [] as { id: string; email: string }[] };
  const emailByLeadId = new Map((leadEmails ?? []).map((l) => [l.id, l.email]));

  const countCta = (rows: { event_type: string }[] | null, type: string) =>
    (rows ?? []).filter((r) => r.event_type === type).length;

  const impressionsToday = countCta(ctaToday.data, "impression");
  const clicksToday = countCta(ctaToday.data, "click");
  const impressionsAll = countCta(ctaAll.data, "impression");

  const deliveriesToday = (nurtureToday.data ?? []).filter((e) => e.event_type === "sent").length;
  const deliveriesAll = (nurtureAll.data ?? []).filter((e) => e.event_type === "sent").length;

  const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 200 });
  const externalUserIds: string[] = [];

  for (const user of authUsers?.users ?? []) {
    if (!user.email || isInternalEmail(user.email)) continue;
    externalUserIds.push(user.id);
  }

  const profiles =
    externalUserIds.length > 0 ? await loadRevuviaProfiles(sb, externalUserIds) : [];

  const paidUserIds = new Set(
    billingRows.filter((b) => b.access_granted && !b.cancelled_at).map((b) => b.user_id)
  );

  const dormantProfiles: { email: string; createdAt: string }[] = [];

  for (const user of authUsers?.users ?? []) {
    if (!user.email || isInternalEmail(user.email)) continue;
    const profile = profiles.find((p) => p.id === user.id);
    if (!profile) continue;
    if (profile.trial_started_at) continue;
    if (paidUserIds.has(user.id)) continue;
    dormantProfiles.push({ email: user.email, createdAt: profile.created_at });
  }

  let externalPaid = 0;
  let failedPayments = 0;
  for (const row of billingRows) {
    const user = authUsers?.users.find((u) => u.id === row.user_id);
    if (!user?.email || isInternalEmail(user.email)) continue;
    if (row.access_granted && !row.cancelled_at) externalPaid += 1;
    if (row.dunning_started_at || row.status === "past_due" || row.status === "unpaid") {
      failedPayments += 1;
    }
  }

  const realLeadCount = (realLeads.data ?? []).length;
  const kpis: RevenueAuditKpis = {
    visitors: dailyMetrics.data?.organic_visits ?? 0,
    ctaImpressions: impressionsToday,
    ctaClicks: clicksToday,
    ctaCtr: impressionsToday > 0 ? Math.round((clicksToday / impressionsToday) * 1000) / 10 : 0,
    leadsCaptured: leadsToday.count ?? 0,
    emailEnrollments: enrollments.data?.length ?? 0,
    emailDeliveries: deliveriesToday,
    trialActivations: trialsToday,
    paidSubscriptions: externalPaid,
    failedPayments,
  };

  const blockers: MetricBlocker[] = [];

  if (kpis.visitors === 0) {
    blockers.push(
      blockerForMetric(
        "Visitors",
        0,
        "No traffic pipeline active",
        "`daily_metrics` is empty — GSC not synced, no organic baseline, founder outbound not started.",
        AVG_MRR_USD * 4,
        "Contact 5 Agadir commerces today (café, salon, restaurant) — ask for 10 min demo.",
        { impact: 9, confidence: 7, ease: 8 }
      )
    );
  }

  if (impressionsAll === 0) {
    blockers.push(
      blockerForMetric(
        "CTA impressions",
        0,
        "Zero CTA telemetry",
        "Growth Engine embed live on revuvia.com but no impressions recorded — no traffic or tracking not reaching GE.",
        AVG_MRR_USD * 2,
        "Open revuvia.com/pricing in incognito → confirm CTA renders → share link to 3 prospects.",
        { impact: 7, confidence: 8, ease: 9 }
      )
    );
  } else if (kpis.ctaImpressions === 0 && impressionsAll > 0) {
    blockers.push(
      blockerForMetric(
        "CTA impressions (today)",
        0,
        "No traffic today",
        "Historical impressions exist but none today.",
        AVG_MRR_USD,
        "Post WhatsApp status with revuvia.com/pricing link to local business group.",
        { impact: 8, confidence: 6, ease: 9 }
      )
    );
  }

  if (kpis.ctaClicks === 0 && kpis.ctaImpressions > 0) {
    blockers.push(
      blockerForMetric(
        "CTA CTR",
        0,
        "CTA not compelling or misplaced",
        `${kpis.ctaImpressions} impressions, 0 clicks.`,
        AVG_MRR_USD * TRIAL_TO_PAID_RATE,
        "A/B test CTA copy in Content Hub — lead with « QR avis Google gratuit » not generic trial.",
        { impact: 6, confidence: 5, ease: 7 }
      )
    );
  }

  if (realLeadCount === 0) {
    blockers.push(
      blockerForMetric(
        "Lead capture",
        0,
        "No real leads in CAS",
        "Only smoke-test leads; zero ICP emails captured via embed or landing.",
        AVG_MRR_USD * 3,
        "Execute today's acquisition plan (below) — 10 outbound touches minimum.",
        { impact: 10, confidence: 8, ease: 7 }
      )
    );
  }

  if (deliveriesAll === 0 && (enrollments.data?.length ?? 0) > 0) {
    const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
    blockers.push(
      blockerForMetric(
        "Email deliveries",
        0,
        resendConfigured ? "Nurture cron schedule gap" : "RESEND_API_KEY missing",
        resendConfigured
          ? "Enrollments exist but 0 `nurture_events`. Cron runs 07:00 UTC once/day; leads after that wait 24h."
          : "Nurture runs dry-run only (`console.info [cas] nurture email dry-run`) — no real sends.",
        AVG_MRR_USD * TRIAL_TO_PAID_RATE * 2,
        resendConfigured
          ? "Run now: `POST /api/acquisition/nurture` with CRON_SECRET. Add 12:00 + 17:00 UTC cron slots."
          : "Set RESEND_API_KEY + NURTURE_FROM_EMAIL on Growth Engine Vercel, then trigger nurture.",
        { impact: 8, confidence: 9, ease: resendConfigured ? 9 : 7 }
      )
    );
  }

  if (trialsTotal === 0) {
    blockers.push(
      blockerForMetric(
        "Trial activations",
        0,
        "Trial never started for external signups",
        "3 external accounts registered Jul 13–26 with `trial_started_at = null`. Auth callback may have been skipped.",
        AVG_MRR_USD * TRIAL_TO_PAID_RATE * dormantProfiles.length,
        "Message each dormant user (drafts below) + trigger `/api/trial/start` on re-login.",
        { impact: 9, confidence: 8, ease: 8 }
      )
    );
  }

  if (externalPaid === 0) {
    blockers.push(
      blockerForMetric(
        "Paid subscriptions",
        0,
        "Lemon Squeezy Test mode + zero conversions",
        "Checkout works in test; KYC pending blocks live charges. No external `checkout_completed` events.",
        AVG_MRR_USD * 100,
        "Complete Lemon KYC → Live mode. Close 1 design partner manually with test checkout today.",
        { impact: 10, confidence: 10, ease: 6 }
      )
    );
  }

  blockers.sort((a, b) => b.ice.score - a.ice.score);
  const biggestBlocker = blockers[0] ?? blockerForMetric("None", 1, "—", "Funnel moving.", 0, "Maintain momentum.", { impact: 1, confidence: 1, ease: 1 });

  const dormantOutreach = dormantProfiles
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((d) => buildDormantOutreach(d.email, d.createdAt, now));

  const emailsWaiting = (pendingNurture.data ?? []).map((row) => ({
    email: emailByLeadId.get(row.lead_id) ?? "unknown",
    step: row.current_step,
    dueAt: row.next_send_at ?? "",
  }));

  const cronFailures: RevenueAuditResult["cronFailures"] = [];
  if (emailsWaiting.length > 0 && deliveriesAll === 0) {
    cronFailures.push({
      cron: "/api/acquisition/nurture (07:00 UTC daily)",
      reason: "Enrollment due but 0 nurture_events — cron ran before lead capture or missed window.",
      fix: "POST /api/acquisition/nurture with Authorization: Bearer $CRON_SECRET",
      logs: "[cas] Expected: nurture_events.event_type=sent. Actual: 0 rows. next_send_at past due.",
    });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    cronFailures.push({
      cron: "All Growth Engine crons",
      reason: "SUPABASE_SERVICE_ROLE_KEY unset on Vercel",
      fix: "Copy service role key from Supabase → Growth Engine Vercel env → redeploy",
      logs: "createServiceRoleClient() uses empty key → Supabase queries fail silently or 500.",
    });
  }

  const failedAutomations: string[] = [];
  if (kpis.visitors === 0) failedAutomations.push("GSC sync → daily_metrics (0 rows today)");
  if (realLeadCount === 0) failedAutomations.push("Organic lead capture (0 ICP leads)");
  if ((trialsTotal) === 0) failedAutomations.push("Trial auto-start on signup (0 trials)");

  const iceActions: IceAction[] = blockers.slice(0, 8).map((b, i) => ({
    rank: i + 1,
    action: b.action,
    ice: b.ice.score,
  }));

  const acquisitionPlan =
    realLeadCount === 0
      ? [
          "08:00 — List 10 commerces Agadir (Google Maps → note owner WhatsApp if visible)",
          "09:00 — Send 5 WhatsApp intros (template in dormant outreach section)",
          "11:00 — Visit 2 commerces with printed Revuvia QR demo",
          "14:00 — Post in 1 groupe Facebook « commerçants Agadir » avec lien pricing",
          "16:00 — Relancer 3 inscrits dormants (email + WhatsApp)",
          "Target: 2 leads réels + 1 essai démarré",
        ]
      : null;

  const activationPlan =
    (trialsTotal) === 0
      ? [
          "Message aboghassane08@gmail.com + aboughassane08@gmail.com + rachid.dhoum@taalim.ma",
          "Offer 5-min screen-share: create business → QR → first scan",
          "Ask them to re-login at revuvia.com/login (triggers trial start)",
          "Follow up J+1 if no business created",
        ]
      : null;

  const salesPlan =
    externalPaid === 0
      ? [
          "Priority: customer #1 (design partner, not scale)",
          "Pick 1 warm contact (restaurant/café you know personally)",
          "Demo live: scan QR → Google review page → show dashboard",
          "Close: Starter 9€/mo or Pro 19€/mo — offer setup call included",
          "If Lemon still Test: document checkout URL for manual test payment",
          "Log outcome in Growth Engine /sales",
        ]
      : null;

  const weeklyPaidTarget = externalPaid + 1;
  const revenueForecast = {
    days7: weeklyPaidTarget * AVG_MRR_USD,
    days30: Math.max(externalPaid, weeklyPaidTarget * 2) * AVG_MRR_USD,
    note:
      externalPaid === 0
        ? "Forecast assumes 1 external payer within 7 days if founder executes sales plan."
        : "Linear extrapolation from current paid base.",
  };

  return {
    date,
    kpis,
    blockers,
    biggestBlocker,
    highestRoiAction: { action: biggestBlocker.action, ice: biggestBlocker.ice.score },
    revenueForecast,
    customersAtRisk: failedPayments > 0 ? ["Check dunning in Lemon dashboard"] : [],
    dormantLeads: dormantOutreach,
    trialsWithoutActivation: dormantOutreach,
    emailsWaiting,
    cronFailures,
    failedAutomations,
    acquisitionPlan,
    activationPlan,
    salesPlan,
    iceActions,
  };
}

/** Markdown ≤2 min read (~400 words). */
export function formatDailyFounderReport(audit: RevenueAuditResult): string {
  const k = audit.kpis;
  const lines: string[] = [
    `# Daily Founder Report — ${audit.date}`,
    `_Revenue Operations · ~2 min read_`,
    "",
    "## Today's KPIs",
    "",
    "| Metric | Today |",
    "|--------|------:|",
    `| Visitors | ${k.visitors} |`,
    `| CTA impressions | ${k.ctaImpressions} |`,
    `| CTA CTR | ${k.ctaCtr}% |`,
    `| Leads captured | ${k.leadsCaptured} |`,
    `| Email enrollments | ${k.emailEnrollments} |`,
    `| Email deliveries | ${k.emailDeliveries} |`,
    `| Trial activations | ${k.trialActivations} |`,
    `| Paid (external) | ${k.paidSubscriptions} |`,
    `| Failed payments | ${k.failedPayments} |`,
    "",
    "## Biggest blocker",
    "",
    `**${audit.biggestBlocker.blocker}** — ${audit.biggestBlocker.why}`,
    `Est. lost MRR: **$${audit.biggestBlocker.lostMrrUsd}/mo**`,
    "",
    "## Highest ROI action (ICE ${audit.highestRoiAction.ice})",
    "",
    audit.highestRoiAction.action,
    "",
    "## Revenue forecast",
    "",
    `- 7 days: **$${audit.revenueForecast.days7} MRR**`,
    `- 30 days: **$${audit.revenueForecast.days30} MRR**`,
    `- ${audit.revenueForecast.note}`,
    "",
  ];

  if (audit.customersAtRisk.length > 0) {
    lines.push("## Customers at risk", "", ...audit.customersAtRisk.map((c) => `- ${c}`), "");
  }

  if (audit.emailsWaiting.length > 0) {
    lines.push("## Emails waiting", "");
    for (const e of audit.emailsWaiting) {
      lines.push(`- ${e.email} — step ${e.step}, due ${e.dueAt}`);
    }
    lines.push("");
  }

  if (audit.cronFailures.length > 0) {
    lines.push("## Cron failures", "");
    for (const c of audit.cronFailures) {
      lines.push(`### ${c.cron}`, `- **Why:** ${c.reason}`, `- **Fix:** ${c.fix}`, `- **Logs:** \`${c.logs}\``, "");
    }
  }

  if (audit.failedAutomations.length > 0) {
    lines.push("## Failed automations", "", ...audit.failedAutomations.map((f) => `- ${f}`), "");
  }

  if (audit.dormantLeads.length > 0) {
    lines.push("## Dormant users — outreach drafts", "");
    for (const d of audit.dormantLeads) {
      lines.push(`### ${d.email} (${d.daysDormant}d dormant)`, "", "**Email:**", "```", d.emailDraft, "```", "", "**WhatsApp:**", "```", d.whatsAppDraft, "```", "", "**Follow-up:**", d.followUpDraft, "");
    }
  }

  if (audit.acquisitionPlan) {
    lines.push("## Today's acquisition plan (0 real leads)", "", ...audit.acquisitionPlan.map((s) => `- ${s}`), "");
  }
  if (audit.activationPlan) {
    lines.push("## Today's activation plan (0 trials)", "", ...audit.activationPlan.map((s) => `- ${s}`), "");
  }
  if (audit.salesPlan) {
    lines.push("## Today's founder sales plan (0 customers)", "", ...audit.salesPlan.map((s) => `- ${s}`), "");
  }

  lines.push("## ICE-ranked actions", "", "| # | Action | ICE |", "|---|--------|----:|");
  for (const a of audit.iceActions) {
    lines.push(`| ${a.rank} | ${a.action} | ${a.ice} |`);
  }

  return lines.join("\n");
}

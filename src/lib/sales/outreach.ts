/**
 * Commercialization OS — Phase 3: personalized outreach generator.
 *
 * Builds a complete outbound kit per prospect (email + LinkedIn + WhatsApp +
 * Facebook + cold-call script) from the detected business problems and
 * expected benefits, with a 3-touch follow-up sequence (d+2, d+5, d+9) that
 * escalates across channels. Pure and deterministic.
 */

import type { ProspectRow } from "@/types/supabase";
import { digitalPresenceScore, reviewsWeakness, seoWeakness } from "@/lib/sales/scoring";
import type { OutreachKit, OutreachMessage } from "@/lib/sales/types";

/** Follow-up cadence in days: d+2 LinkedIn, d+5 WhatsApp, d+9 call. */
export const FOLLOW_UP_CADENCE_DAYS = [2, 5, 9];

const INDUSTRY_BENEFITS: Record<string, string[]> = {
  restaurant: [
    "3x more Google reviews with a smart QR code on tables and receipts",
    "Repeat customers from review replies and local SEO",
  ],
  cafe: [
    "Turn every coffee run into a 5-star review automatically",
    "Rank in the local map pack for 'cafe near me' searches",
  ],
  salon: [
    "Every appointment becomes a review — no chasing clients",
    "Fill your calendar with 5-star reputation",
  ],
  dentist: [
    "Patient reviews drive new bookings and trust",
    "Beat competitors in the local pack for dental searches",
  ],
  generic: [
    "Automated review collection with a smart QR code",
    "Local SEO content that wins the map pack",
  ],
};

/** Detected, human-readable business problems (drive the pitch). */
export function detectedProblems(p: ProspectRow): string[] {
  const problems: string[] = [];
  const reviews = reviewsWeakness(p.est_monthly_reviews);
  const seo = seoWeakness(p.est_seo_score, p.est_traffic);
  const presence = digitalPresenceScore(p);

  if (reviews >= 70) {
    const count = p.est_monthly_reviews ?? 0;
    problems.push(
      `only ~${Math.max(count, 1)} Google reviews — too few for new customers to trust ${p.company}`
    );
  }
  if (seo >= 60) {
    problems.push(`${p.company} is invisible on Google for local searches`);
  }
  if (p.website === null) {
    problems.push("no website to convert search traffic into calls or bookings");
  }
  if (p.google_maps_url === null) {
    problems.push("no visible Google Business Profile presence");
  }
  if (!presence.owned.includes("facebook") && !presence.owned.includes("instagram")) {
    problems.push("no active social channels to capture local demand");
  }
  return problems.length > 0 ? problems : ["reviews and local presence are good but hard to grow"];
}

/** Expected benefits for this business. */
export function benefitsFor(industry: string | null): string[] {
  if (!industry) return INDUSTRY_BENEFITS.generic;
  const key = industry.trim().toLowerCase();
  if (key.includes("restaurant") || key.includes("food") || key.includes("cafe") || key.includes("coffee")) {
    return key.includes("cafe") || key.includes("coffee")
      ? INDUSTRY_BENEFITS.cafe
      : INDUSTRY_BENEFITS.restaurant;
  }
  if (key.includes("salon") || key.includes("beauty") || key.includes("spa")) return INDUSTRY_BENEFITS.salon;
  if (key.includes("dent") || key.includes("clinic") || key.includes("medical")) return INDUSTRY_BENEFITS.dentist;
  return INDUSTRY_BENEFITS.generic;
}

function greeting(contactName: string | null): string {
  return contactName ? `Hi ${contactName}` : "Hi";
}

/** First-touch email built from the detected problems. */
export function buildFirstTouchEmail(p: ProspectRow): OutreachMessage {
  const benefits = benefitsFor(p.industry);
  const problems = detectedProblems(p);
  const body = [
    `${greeting(p.contact_name)},`,
    "",
    `I looked at ${p.company} and noticed ${problems[0]}.`,
    problems[1] ? `Also ${problems[1].charAt(0).toLowerCase() + problems[1].slice(1)}.` : null,
    "",
    `Revuvia fixes exactly this: ${benefits[0]}, and ${benefits[1]}.`,
    "",
    "Worth a 10-minute walkthrough this week?",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    channel: "email",
    templateKey: "first_touch_email",
    subject: `Quick idea for ${p.company}'s reviews`,
    body,
    delayDays: 0,
  };
}

/** Follow-up messages escalate across channels (LinkedIn, WhatsApp, call). */
export function buildFollowUps(p: ProspectRow): OutreachMessage[] {
  const benefits = benefitsFor(p.industry);
  const lead = p.contact_name ?? "you";

  return [
    {
      channel: "linkedin",
      templateKey: "follow_up_linkedin",
      subject: null,
      body: `Hi ${lead}, following up on my note about ${p.company}'s reviews. Happy to share a 2-minute example of what other ${p.industry ?? "local"} businesses do with Revuvia.`,
      delayDays: FOLLOW_UP_CADENCE_DAYS[0],
      escalation: true,
    },
    {
      channel: "whatsapp",
      templateKey: "follow_up_whatsapp",
      subject: null,
      body: `Hi ${lead}, one more ping — ${benefits[0].charAt(0).toLowerCase() + benefits[0].slice(1)}. Is Thursday a good time for a quick call?`,
      delayDays: FOLLOW_UP_CADENCE_DAYS[1],
      escalation: true,
    },
    {
      channel: "call",
      templateKey: "follow_up_call",
      subject: null,
      body: `Call script: "Hi ${lead}, I'm from Revuvia — we help ${p.industry ?? "local"} businesses like ${p.company} get more reviews and win the map pack. Do you have 90 seconds?"`,
      delayDays: FOLLOW_UP_CADENCE_DAYS[2],
      escalation: true,
    },
  ];
}

/** Full personalized outreach kit for one prospect. */
export function buildOutreachKit(p: ProspectRow): OutreachKit {
  return {
    prospectId: p.id,
    company: p.company,
    industry: p.industry,
    contactName: p.contact_name,
    problems: detectedProblems(p),
    benefits: benefitsFor(p.industry),
    firstTouch: buildFirstTouchEmail(p),
    followUps: buildFollowUps(p),
  };
}

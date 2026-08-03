/**
 * Lead generation loop — Sprint 4, Phase 4.
 *
 * Weekly: generates new lead magnets, landing page ideas, CTA improvements
 * and email sequences — everything ranked by ICE. Deterministic; derives
 * topics from the best-performing content.
 */

import { iceScore } from "@/lib/ops/ice";
import type { GrowthSnapshot, LeadGenerationItem, LeadGenerationPlan } from "@/lib/ops/types";

export const MAGNET_FORMATS = ["checklist", "guide", "template", "pdf"] as const;
export type MagnetFormat = (typeof MAGNET_FORMATS)[number];

export interface MagnetIdea {
  id: string;
  title: string;
  format: MagnetFormat;
  topic: string;
  ice: number;
}

/** Lead magnet ideas from the top content topics. */
export function generateLeadMagnets(
  topics: string[],
  maxMagnets = 3
): MagnetIdea[] {
  return topics.slice(0, maxMagnets).map((topic, i) => {
    const format = MAGNET_FORMATS[i % MAGNET_FORMATS.length];
    const title =
      format === "checklist"
        ? `${topic}: the checklist`
        : format === "guide"
          ? `${topic}: the practical guide`
          : format === "template"
            ? `${topic}: editable template`
            : `${topic}: PDF starter pack`;
    return {
      id: `magnet-${i}`,
      title,
      format,
      topic,
      ice: iceScore(8, 0.8, 8),
    };
  });
}

/** One landing page per magnet. */
export function landingPageIdeas(magnets: MagnetIdea[]): LeadGenerationItem[] {
  return magnets.map((m, i) => ({
    id: `landing-${i}`,
    kind: "landing_page",
    title: `Landing page: ${m.title}`,
    detail: `Capture leads for "${m.topic}" with a dedicated landing page and the ${m.format} download.`,
    impact: 8,
    ease: 7,
    ice: iceScore(8, 0.75, 7),
  }));
}

/** CTA improvements driven by the current conversion rate. */
export function ctaImprovements(snapshot: GrowthSnapshot): LeadGenerationItem[] {
  const { weekly, conversionRate } = snapshot;
  const items: LeadGenerationItem[] = [];
  if (conversionRate < 0.02) {
    items.push({
      id: "cta-0",
      kind: "cta",
      title: "Add a lead-magnet CTA above the fold",
      detail: `Conversion is ${(conversionRate * 100).toFixed(2)}% (${weekly.signups}/${weekly.visits} visits). Promote the best magnet on every published article.`,
      impact: 7,
      ease: 8,
      ice: iceScore(7, 0.8, 8),
    });
  }
  items.push({
    id: "cta-1",
    kind: "cta",
    title: "Replace generic CTAs with magnet-specific ones",
    detail: "Each article should offer one targeted magnet per audience, not a generic 'Contact us'.",
    impact: 6,
    ease: 8,
    ice: iceScore(6, 0.75, 8),
  });
  return items;
}

/** 3-step nurture sequence per magnet. */
export function emailSequences(magnets: MagnetIdea[]): LeadGenerationItem[] {
  return magnets.map((m, i) => ({
    id: `sequence-${i}`,
    kind: "email_sequence",
    title: `Nurture sequence: ${m.topic}`,
    detail: `3 emails after download: deliver the ${m.format}, show a use case, pitch a demo call.`,
    impact: 8,
    ease: 6,
    ice: iceScore(8, 0.7, 6),
  }));
}

export interface LeadLoopInput {
  snapshot: GrowthSnapshot;
  /** Top content topics (usually article titles). */
  topics?: string[];
}

/** Build the weekly lead generation plan (all items ranked by ICE). */
export function buildLeadGenerationPlan(input: LeadLoopInput): LeadGenerationPlan {
  const topics =
    input.topics && input.topics.length > 0
      ? input.topics
      : input.snapshot.content.map((c) => c.title).filter(Boolean);

  const magnets = generateLeadMagnets(topics);
  const items: LeadGenerationItem[] = [
    ...magnets.map((m, i): LeadGenerationItem => ({
      id: `magnet-${i}`,
      kind: "lead_magnet",
      title: m.title,
      detail: `Publish a ${m.format} on "${m.topic}" to capture emails.`,
      impact: 8,
      ease: 8,
      ice: m.ice,
    })),
    ...landingPageIdeas(magnets),
    ...ctaImprovements(input.snapshot),
    ...emailSequences(magnets),
  ];

  items.sort((a, b) => b.ice - a.ice || a.id.localeCompare(b.id));

  return {
    weekStart: input.snapshot.weekStart,
    weekEnd: input.snapshot.weekEnd,
    items,
    topMagnets: magnets.map((m) => m.title),
  };
}

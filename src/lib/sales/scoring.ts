/**
 * Commercialization OS — Phase 2: lead scoring engine.
 *
 * Scores every prospect with acquisition intelligence (digital presence,
 * reviews weakness, SEO weakness, revenue potential, urgency, competition)
 * and produces a 0-100 total, a hot/warm/cold temperature and an ICE-style
 * priority. Win probability reuses the existing ops sales model.
 * Pure and deterministic.
 */

import type { ProspectRow } from "@/types/supabase";
import { expectedProbability } from "@/lib/ops/sales";
import type { DigitalPresence, LeadScore, LeadTemperature, IntelligenceProspect } from "@/lib/sales/types";

const TEMPERATURE_THRESHOLD_HOT = 65;
const TEMPERATURE_THRESHOLD_WARM = 40;

/** 0-100 digital presence from owned channels (website, maps, socials). */
export function digitalPresenceScore(p: Pick<ProspectRow, "website" | "google_maps_url" | "facebook_url" | "instagram_url" | "linkedin_url">): DigitalPresence {
  const owned: string[] = [];
  if (p.website) owned.push("website");
  if (p.google_maps_url) owned.push("google_maps");
  if (p.facebook_url) owned.push("facebook");
  if (p.instagram_url) owned.push("instagram");
  if (p.linkedin_url) owned.push("linkedin");

  const weights: Record<string, number> = {
    website: 30,
    google_maps: 15,
    facebook: 20,
    instagram: 20,
    linkedin: 15,
  };
  const score = Math.min(100, owned.reduce((sum, c) => sum + weights[c], 0));
  const all = Object.keys(weights);
  return { score, channels: [], owned, missing: all.filter((c) => !owned.includes(c)) };
}

/** 0-100: weak review base = large opportunity for a review tool. */
export function reviewsWeakness(reviews: number | null): number {
  if (reviews === null) return 60; // unknown — mild weakness
  if (reviews <= 5) return 90;
  if (reviews <= 15) return 70;
  if (reviews <= 30) return 50;
  if (reviews <= 50) return 30;
  return 15;
}

/** 0-100: weak SEO = room to win organic traffic for them. */
export function seoWeakness(seoScore: number | null, traffic: number | null): number {
  if (seoScore !== null) {
    if (seoScore <= 30) return 80;
    if (seoScore <= 50) return 60;
    if (seoScore <= 70) return 40;
    return 20;
  }
  if (traffic !== null) {
    if (traffic <= 100) return 70;
    if (traffic <= 1000) return 50;
    return 30;
  }
  return 50; // unknown — neutral
}

/** 0-100: estimated monthly revenue potential (traffic × conv × ACV). */
export function revenuePotential(traffic: number | null, acvUsd: number | null): number {
  const visits = traffic ?? 0;
  const acv = acvUsd && acvUsd > 0 ? acvUsd : 480; // default annual ACV (39/mo)
  const yearly = visits * 0.01 * acv; // 1% visitor -> customer conversion
  return Math.min(100, Math.round(yearly / 500));
}

/** 0-100: competitive pressure by traffic size. */
export function competitionScore(traffic: number | null, companySize: number | null): number {
  let score = 20;
  if (traffic !== null) {
    if (traffic >= 5000) score = 80;
    else if (traffic >= 1000) score = 60;
    else if (traffic >= 100) score = 40;
  }
  if (companySize !== null && companySize >= 20) score = Math.min(100, score + 10);
  return score;
}

/** 0-100: urgency — visible damage makes a fix timely. */
export function urgencyScore(p: ProspectRow): number {
  const rw = reviewsWeakness(p.est_monthly_reviews);
  const sw = seoWeakness(p.est_seo_score, p.est_traffic);
  const hasTraffic = (p.est_traffic ?? 0) > 0;
  const trafficBonus = hasTraffic ? (rw >= 50 ? 20 : 10) : 0;
  return Math.min(100, Math.round(rw * 0.5 + sw * 0.2 + trafficBonus));
}

/** Map a total score to a temperature bucket. */
export function temperatureOf(total: number): LeadTemperature {
  if (total >= TEMPERATURE_THRESHOLD_HOT) return "hot";
  if (total >= TEMPERATURE_THRESHOLD_WARM) return "warm";
  return "cold";
}

/** Full lead score for one prospect (Phase 2). */
export function scoreProspectLead(p: ProspectRow): LeadScore {
  const presence = digitalPresenceScore(p);
  const reviews = reviewsWeakness(p.est_monthly_reviews);
  const seo = seoWeakness(p.est_seo_score, p.est_traffic);
  const revenue = revenuePotential(p.est_traffic, p.acv_usd);
  const urgency = urgencyScore(p);
  const competition = competitionScore(p.est_traffic, p.company_size);
  const probability = Math.max(
    0.03, // a fresh lead always carries a small baseline win chance
    expectedProbability(p, (p.priority_score ?? 0) + (p.lead_score ?? 0) / 2)
  );

  const total = Math.min(
    100,
    Math.round(reviews * 0.35 + seo * 0.25 + urgency * 0.2 + revenue * 0.1 + presence.score * 0.1)
  );
  const ice = Math.round(total * probability * 10);

  return {
    total,
    digitalPresence: presence.score,
    reviewsWeakness: reviews,
    seoWeakness: seo,
    revenuePotential: revenue,
    urgency,
    competition,
    probability,
    ice,
    temperature: temperatureOf(total),
  };
}

/** Score all prospects and return the ranked opportunity list. */
export function priorityQueue(prospects: ProspectRow[], limit = 20): IntelligenceProspect[] {
  return prospects
    .filter((p) => !["won", "lost", "archived", "closed"].includes(p.status))
    .map((p) => ({ ...p, score: scoreProspectLead(p) }))
    .sort((a, b) => b.score.ice - a.score.ice || b.score.total - a.score.total)
    .slice(0, limit);
}

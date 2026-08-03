/**
 * Content Quality AI — Phase 2.
 * Scores generated content across 9 dimensions and produces a /100 overall.
 * Pure and deterministic (unit-testable), with optional AI confidence input.
 *
 * Scoring weights (sum = 1.0):
 *   seoQuality     0.15
 *   readability    0.15
 *   originality    0.10
 *   ctaQuality     0.10
 *   keywordDensity 0.10
 *   titleQuality   0.10
 *   metaQuality    0.10
 *   structure      0.10
 *   aiConfidence   0.10
 */

import type { ContentQualityResult, QualityDimension, QualityDimensionKey } from "@/types";

export const QUALITY_PASS_THRESHOLD = 80;

export const QUALITY_WEIGHTS: Record<QualityDimensionKey, number> = {
  seoQuality: 0.15,
  readability: 0.15,
  originality: 0.1,
  ctaQuality: 0.1,
  keywordDensity: 0.1,
  titleQuality: 0.1,
  metaQuality: 0.1,
  structure: 0.1,
  aiConfidence: 0.1,
};

export interface QualityInput {
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  bodyMarkdown: string;
  excerpt?: string;
  featuredSnippet?: string;
  tags?: string[];
  faqs?: unknown[];
  internalLinks?: unknown[];
  cta?: { label?: string; href?: string; position?: string } | null;
  jsonLd?: Record<string, unknown>;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  wordCountTarget?: number;
  aiConfidence?: number; // 0-100 from the generation provider (optional)
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(Math.max(value, min), max);

function dim(score: number, notes: string[]): Omit<QualityDimension, "label"> {
  return { score: Math.round(clamp(score)), notes };
}

const DIMENSION_LABELS: Record<QualityDimensionKey, string> = {
  seoQuality: "SEO quality",
  readability: "Readability",
  originality: "Originality",
  ctaQuality: "CTA quality",
  keywordDensity: "Keyword density",
  titleQuality: "Title quality",
  metaQuality: "Meta quality",
  structure: "Structure",
  aiConfidence: "AI confidence",
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches?.length ?? 1;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "$1")
    .replace(/[#>*_\-~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headings(md: string): { level: number; text: string }[] {
  return md
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      return { level: match?.[1].length ?? 1, text: match?.[2].trim() ?? "" };
    });
}

/** Flesch-like readability heuristic: longer sentences + long words lower the score. */
export function scoreReadability(bodyMarkdown: string): Omit<QualityDimension, "label"> {
  const text = stripMarkdown(bodyMarkdown);
  const words = countWords(text);
  if (words === 0) return dim(0, ["Empty body"]);

  const sentences = Math.max(countSentences(text), 1);
  const avgSentence = words / sentences;
  const avgWord = words / Math.max(text.split(" ").length, 1) * (text.length / Math.max(words, 1));

  let score = 100;
  if (avgSentence > 20) score -= (avgSentence - 20) * 3;
  if (avgSentence > 30) score -= (avgSentence - 30) * 2;
  if (avgWord > 6.5) score -= (avgWord - 6.5) * 8;
  if (words < 300) score -= (300 - words) * 0.1;

  const notes: string[] = [];
  notes.push(`~${words} words, ~${Math.round(avgSentence)} words/sentence`);
  if (score < 60) notes.push("Long sentences or dense vocabulary detected");
  return dim(score, notes);
}

/** Structure: heading hierarchy, lists, sections, FAQs. */
export function scoreStructure(bodyMarkdown: string, faqs: unknown[] = []): Omit<QualityDimension, "label"> {
  const notes: string[] = [];
  const heads = headings(bodyMarkdown);
  const h2 = heads.filter((h) => h.level === 2).length;
  const h3 = heads.filter((h) => h.level === 3).length;
  const h1 = heads.filter((h) => h.level === 1).length;

  const hasLists = /(^|\n)\s*[-*]\s/.test(bodyMarkdown) || /(^|\n)\s*\d+\.\s/.test(bodyMarkdown);
  const hasParagraphs = bodyMarkdown.split("\n\n").filter((p) => p.trim().length > 40).length >= 3;
  const wordCount = countWords(bodyMarkdown);

  let score = 100;
  if (h1 > 1) score -= 10;
  if (h2 === 0 && h3 === 0) score -= 40;
  if (h2 < 3) score -= (3 - h2) * 8;
  if (h3 < 2) score -= (2 - h3) * 4;
  if (!hasLists) score -= 8;
  if (!hasParagraphs) score -= 10;
  if (wordCount < 800) score -= (800 - wordCount) * 0.02;
  if (faqs.length < 2) score -= 6;

  notes.push(`H2×${h2}, H3×${h3}, lists:${hasLists}, FAQs:${faqs.length}`);
  if (wordCount >= 800) notes.push(`~${wordCount} words`);
  return dim(score, notes);
}

/** Title quality: length 30-60, keyword presence, no clickbait, not duplicated in body H1. */
export function scoreTitleQuality(title: string, bodyMarkdown: string, keyword = ""): Omit<QualityDimension, "label"> {
  const notes: string[] = [];
  const length = title.trim().length;
  let score = 100;

  if (length < 20) score -= (20 - length) * 3;
  if (length > 70) score -= (length - 70) * 2;
  if (length >= 30 && length <= 60) notes.push("Optimal title length");

  const lower = title.toLowerCase();
  const hasKeyword = keyword ? lower.includes(keyword.toLowerCase()) : lower.length > 0;
  if (!hasKeyword && keyword) {
    score -= 25;
    notes.push("Primary keyword missing from title");
  } else if (keyword) {
    notes.push("Primary keyword present");
  }

  if (/(clickbait|shocking|you won't believe|#1|ultimate secret)/i.test(lower)) {
    score -= 20;
    notes.push("Clickbait phrasing detected");
  }

  const firstHeading = headings(bodyMarkdown)[0]?.text ?? "";
  if (firstHeading && firstHeading.toLowerCase() === lower) {
    notes.push("Title matches H1");
  } else {
    score -= 10;
    notes.push("Title differs from H1");
  }

  return dim(score, notes);
}

/** Meta quality: meta title <60, meta description 120-160. */
export function scoreMetaQuality(metaTitle: string, metaDescription: string): Omit<QualityDimension, "label"> {
  const notes: string[] = [];
  let score = 100;

  if (!metaTitle) score -= 40;
  else if (metaTitle.length > 60) score -= (metaTitle.length - 60) * 1.5;
  else notes.push(`Meta title ${metaTitle.length} chars`);

  if (!metaDescription) score -= 40;
  else if (metaDescription.length < 120) score -= (120 - metaDescription.length) * 0.8;
  else if (metaDescription.length > 165) score -= (metaDescription.length - 165) * 0.8;
  else notes.push(`Meta description ${metaDescription.length} chars`);

  return dim(score, notes);
}

/** Keyword density: target 1-3% of body words for the primary keyword. */
export function scoreKeywordDensity(bodyMarkdown: string, keyword: string, secondary: string[] = []): Omit<QualityDimension, "label"> {
  const notes: string[] = [];
  if (!keyword) return dim(50, ["No primary keyword provided for density check"]);

  const text = stripMarkdown(bodyMarkdown);
  const words = countWords(text);
  if (words === 0) return dim(0, ["Empty body"]);

  const target = keyword.toLowerCase();
  const occurrences =
    (text.toLowerCase().match(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  const density = (occurrences / words) * 100;

  let score = 100;
  if (occurrences === 0) {
    score = 10;
  } else if (density > 4) {
    score -= (density - 4) * 15;
  } else if (density > 3) {
    score -= (density - 3) * 10;
  } else if (density < 1) {
    score -= (1 - density) * 30;
  } else if (density < 2) {
    score -= 5;
  }

  notes.push(`Density ${density.toFixed(2)}% (${occurrences} of ${words} words)`);

  const secondaryHits = secondary.filter((k) => k && text.toLowerCase().includes(k.toLowerCase())).length;
  if (secondary.length > 0) {
    const coverage = secondaryHits / secondary.length;
    notes.push(`${secondaryHits}/${secondary.length} secondary keywords used`);
    if (coverage < 0.5) score -= 15;
  }

  return dim(score, notes);
}

/** CTA quality: label, href, position present and sensible. */
export function scoreCtaQuality(cta?: QualityInput["cta"]): Omit<QualityDimension, "label"> {
  const notes: string[] = [];
  let score = 100;

  if (!cta?.label) {
    score -= 40;
    notes.push("No CTA label");
  } else if (cta.label.length < 2) {
    score -= 15;
  } else {
    notes.push(`CTA: ${cta.label}`);
  }

  if (!cta?.href) {
    score -= 35;
    notes.push("No CTA href");
  } else if (!/^\/(pricing|register|features|#)/.test(cta.href) && !/^https?:\/\//.test(cta.href)) {
    score -= 10;
    notes.push("CTA href not clearly actionable");
  }

  if (!cta?.position) {
    score -= 15;
    notes.push("No CTA position");
  }

  return dim(score, notes);
}

/** Originality heuristics: diversity of vocabulary + lack of repetition (no corpus). */
export function scoreOriginality(bodyMarkdown: string): Omit<QualityDimension, "label"> {
  const text = stripMarkdown(bodyMarkdown);
  const words = countWords(text);
  if (words < 30) return dim(0, ["Body too short to assess"]);

  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  const unique = new Set(tokens).size;
  const typeTokenRatio = unique / tokens.length; // 1.0 = maximal diversity
  const notes: string[] = [];

  let score = 100;
  if (typeTokenRatio < 0.35) {
    score -= (0.35 - typeTokenRatio) * 200;
    notes.push("Repetitive vocabulary");
  } else {
    notes.push(`Lexical diversity ${(typeTokenRatio * 100).toFixed(0)}%`);
  }

  const longWords = tokens.filter((t) => t.length >= 8).length / tokens.length;
  if (longWords > 0.35) {
    score -= 8;
    notes.push("Heavy jargon density");
  }

  return dim(score, notes);
}

/** SEO quality: featured snippet, JSON-LD, tags, internal links, keyword in headings. */
export function scoreSeoQuality(input: {
  bodyMarkdown: string;
  featuredSnippet?: string;
  tags?: string[];
  internalLinks?: unknown[];
  jsonLd?: Record<string, unknown>;
  keyword?: string;
}): Omit<QualityDimension, "label"> {
  const notes: string[] = [];
  let score = 100;

  if (!input.featuredSnippet) {
    score -= 20;
    notes.push("No featured snippet answer");
  } else {
    notes.push("Featured snippet present");
  }

  if (!input.tags || input.tags.length < 2) {
    score -= 10;
    notes.push("Few tags");
  }

  if (!input.internalLinks || input.internalLinks.length < 2) {
    score -= 15;
    notes.push("Few internal links");
  } else {
    notes.push(`${input.internalLinks.length} internal links`);
  }

  if (!input.jsonLd || Object.keys(input.jsonLd).length === 0) {
    score -= 15;
    notes.push("Missing JSON-LD");
  } else {
    notes.push("JSON-LD present");
  }

  if (input.keyword) {
    const headText = headings(input.bodyMarkdown)
      .map((h) => h.text.toLowerCase())
      .join(" ");
    if (!headText.includes(input.keyword.toLowerCase())) {
      score -= 15;
      notes.push("Keyword absent from headings");
    } else {
      notes.push("Keyword in headings");
    }
  }

  return dim(score, notes);
}

/** AI confidence: provider signal normalized, or derived from JSON/parse completeness. */
export function scoreAiConfidence(provider?: number): Omit<QualityDimension, "label"> {
  if (typeof provider === "number") {
    return dim(clamp(provider), [`Provider confidence ${Math.round(provider)}%`]);
  }
  // No provider signal — neutral 80 (assumes successful structured output).
  return dim(80, ["No provider confidence signal; assumed structured output success"]);
}

/** Main entry: score a generated content bundle across all dimensions. */
export function scoreContent(input: QualityInput): ContentQualityResult {
  const primaryKeyword = input.primaryKeyword ?? "";
  const dimensions: Record<QualityDimensionKey, Omit<QualityDimension, "label">> = {
    seoQuality: scoreSeoQuality({
      bodyMarkdown: input.bodyMarkdown,
      featuredSnippet: input.featuredSnippet,
      tags: input.tags,
      internalLinks: input.internalLinks,
      jsonLd: input.jsonLd,
      keyword: primaryKeyword,
    }),
    readability: scoreReadability(input.bodyMarkdown),
    originality: scoreOriginality(input.bodyMarkdown),
    ctaQuality: scoreCtaQuality(input.cta),
    keywordDensity: scoreKeywordDensity(input.bodyMarkdown, primaryKeyword, input.secondaryKeywords ?? []),
    titleQuality: scoreTitleQuality(input.title, input.bodyMarkdown, primaryKeyword),
    metaQuality: scoreMetaQuality(input.metaTitle ?? "", input.metaDescription ?? ""),
    structure: scoreStructure(input.bodyMarkdown, input.faqs ?? []),
    aiConfidence: scoreAiConfidence(input.aiConfidence),
  };

  let overall = 0;
  const labeled: Record<QualityDimensionKey, QualityDimension> = {} as Record<QualityDimensionKey, QualityDimension>;
  for (const key of Object.keys(QUALITY_WEIGHTS) as QualityDimensionKey[]) {
    const raw = dimensions[key];
    labeled[key] = { ...raw, label: DIMENSION_LABELS[key] };
    overall += raw.score * QUALITY_WEIGHTS[key];
  }
  overall = Math.round(clamp(overall));

  return {
    overall,
    passed: overall >= QUALITY_PASS_THRESHOLD,
    dimensions: labeled,
    createdAt: new Date().toISOString(),
  };
}

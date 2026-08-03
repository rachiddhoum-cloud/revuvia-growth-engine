import { aiComplete, fastModel, parseAiJson } from "@/lib/ai";
import {
  classifyIntent,
  detectSerpFeatures,
  estimateDifficulty,
  opportunityScore,
} from "@/lib/seo/scoring";
import type {
  AnalyzedKeyword,
  KeywordClusterOutput,
  KeywordIntent,
  SeoOpportunityReport,
} from "@/types";

const SYSTEM = `You are a senior SEO strategist for Revuvia, a SaaS that helps local businesses
collect more Google reviews via smart links and QR codes.

You expand a seed keyword into a full topic map: related keywords, search volumes,
intent and competitive signals. Respond with valid JSON only.`;

const OUTPUT_SCHEMA = `{
  "clusters": [
    { "name": "cluster display name", "intent": "informational|commercial|transactional|navigational", "keywords": ["related keyword"] }
  ]
}`;

async function expandKeywords(seed: string, count = 12): Promise<{ clusters: KeywordClusterOutput[] }> {
  const { system, prompt } = {
    system: SYSTEM,
    prompt: `Expand the seed keyword "${seed}" for the French + English market of a SaaS product
for collecting Google reviews in local businesses (cafés, restaurants, salons, dentists).

Generate ${count} high-value related keywords organized into semantic clusters
(3-5 keywords per cluster). Cover: main topic, "how to", "best/tools", "benefits",
"for [vertical]", long-tail variants. Mix French and English keywords when natural.

Return JSON matching: ${OUTPUT_SCHEMA}`,
  };

  const result = await aiComplete(fastModel(), {
    system,
    prompt,
    responseFormat: "json",
    maxTokens: 4096,
    module: "seo",
  });
  return parseAiJson<{ clusters: KeywordClusterOutput[] }>(result.content);
}

function enrich(keyword: string, cluster: KeywordClusterOutput | null, index: number): AnalyzedKeyword {
  const intent = cluster?.intent as KeywordIntent | undefined ?? classifyIntent(keyword);
  const serpFeatures = detectSerpFeatures(keyword);
  const difficulty = estimateDifficulty({ keyword, baseSignal: undefined });
  // deterministic pseudo-volume from keyword length + position
  const volume = Math.max(30, (keywordLengthSignal(keyword) + index * 11) % 2900);
  const cpc = Math.round((difficulty / 10 + (intent === "transactional" ? 0.9 : 0.3)) * 100) / 100;
  const opportunity = opportunityScore({ keyword, volume, difficulty, intent });

  return {
    keyword,
    volume,
    difficulty,
    intent,
    cpc,
    opportunityScore: opportunity,
    cluster: cluster?.name ?? null,
    priority: 0,
    serpFeatures,
    topCompetitors: [],
    rationale: `Intent ${intent}, difficulty ${difficulty}, volume ~${volume}.`,
  };
}

function keywordLengthSignal(keyword: string): number {
  const words = keyword.trim().split(/\s+/).length;
  return words * 180;
}

/** Module 1 main entry: turn a seed keyword into ranked SEO opportunities. */
export async function analyzeSeedKeyword(seed: string): Promise<SeoOpportunityReport> {
  const { clusters } = await expandKeywords(seed);

  const opportunities: AnalyzedKeyword[] = [];
  let index = 0;
  for (const cluster of clusters) {
    for (const keyword of cluster.keywords) {
      opportunities.push(enrich(keyword, cluster, index++));
    }
  }

  // dedupe + rank
  const seen = new Set<string>();
  const unique = opportunities.filter((o) => {
    const key = o.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => b.opportunityScore - a.opportunityScore);
  unique.forEach((o, i) => {
    o.priority = i + 1;
  });

  return {
    seedKeyword: seed,
    analyzedAt: new Date().toISOString(),
    clusters,
    opportunities: unique,
  };
}

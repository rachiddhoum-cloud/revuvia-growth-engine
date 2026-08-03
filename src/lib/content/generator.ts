import { aiComplete, heavyModel, parseAiJson } from "@/lib/ai";
import { slugify } from "@/lib/utils";
import type { GeneratedContent } from "@/types";

const SYSTEM = `You are a world-class SEO content strategist and copywriter for Revuvia,
a SaaS that helps local businesses collect more Google reviews using smart links,
printable QR codes and real-time analytics.

You produce publication-ready, conversion-focused content. You write in clear,
engaging language with proper heading hierarchy (H2/H3), short paragraphs, bullet
lists and strong CTAs. Output valid JSON only.`;

const OUTPUT_SCHEMA = `{
  "title": "H1 title (under 60 chars, keyword-first)",
  "excerpt": "one-sentence summary",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "meta description 140-160 chars",
  "bodyMarkdown": "full article body in markdown with H2/H3 sections",
  "faqs": [{ "question": "...", "answer": "..." }],
  "jsonLd": { "Article": { "@type": "Article", "headline": "...", "description": "..." } },
  "internalLinks": [{ "text": "anchor text", "url": "/pricing", "anchor": "context sentence" }],
  "cta": { "label": "CTA text", "href": "/register", "tone": "primary", "position": "bottom" },
  "featuredSnippet": "direct answer under 50 words, copy-paste ready for position zero",
  "tags": ["seo", "google-reviews"]
}`;

export interface GenerateContentInput {
  keyword: string;
  intent?: string;
  kind?: "article" | "landing" | "faq";
  audience?: string;
  extraInstructions?: string;
  ctaHref?: string;
}

export async function generateContent(input: GenerateContentInput): Promise<GeneratedContent> {
  const kind = input.kind ?? "article";
  const kindLabel = kind === "landing" ? "high-converting landing page" : kind === "faq" ? "FAQ page" : "SEO article";

  const prompt = `Write a ${kindLabel} targeting the keyword "${input.keyword}".

Context:
- Audience: ${input.audience ?? "local business owners (cafés, restaurants, salons, dentists) in Morocco and the French-speaking world"}
- Search intent: ${input.intent ?? "auto-detect and optimize for it"}
- Primary CTA target: ${input.ctaHref ?? "/register"}
- Brand: Revuvia — smart Google review links, printable QR codes, analytics, reminders.

SEO requirements:
- metaTitle & metaDescription optimized for CTR
- bodyMarkdown: complete, at least 1200 words for article, structured with H2/H3
- include real questions people ask for the FAQ section (4-6)
- jsonLd: include a valid Article (or FAQPage for faq kind) schema node
- internalLinks: 3 internal links max, pointing to /, /pricing, /features
- featuredSnippet: concise, direct answer for position zero
- tags: 3-5 relevant tags
${input.extraInstructions ? `- Extra instructions: ${input.extraInstructions}` : ""}

Return JSON matching: ${OUTPUT_SCHEMA}`;

  const result = await aiComplete(heavyModel(), {
    system: SYSTEM,
    prompt,
    responseFormat: "json",
    maxTokens: 8192,
    module: "content",
  });

  const parsed = parseAiJson<Omit<GeneratedContent, "kind" | "slug">>(result.content);
  const slug = slugify(parsed.title);

  return {
    ...parsed,
    kind,
    slug,
  };
}

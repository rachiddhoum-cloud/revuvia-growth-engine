/**
 * Internal Linking Engine — Phase 3.
 * After an article is generated, detect:
 *   - related published articles (shared topics/tags/keywords)
 *   - Revuvia pages (pricing, features, blog, landing pages)
 * and produce ranked internal link suggestions.
 *
 * Pure + deterministic: token-based similarity, canonical page map, anchor extraction.
 */

import type { InternalLinkSuggestion } from "@/types";

export interface LinkableArticle {
  id: string;
  title: string;
  slug: string;
  tags?: string[];
  excerpt?: string;
  keywords?: string[];
}

export interface LinkingInput {
  title: string;
  bodyMarkdown: string;
  primaryKeyword?: string;
  tags?: string[];
  publishedArticles?: LinkableArticle[];
  appUrl?: string;
}

export const CANONICAL_PAGES = [
  { targetType: "pricing" as const, path: "/pricing", label: "pricing", keywords: ["pricing", "tarif", "price", "plan", "abonnement"] },
  { targetType: "landing" as const, path: "/", label: "homepage", keywords: ["revuvia", "qrcode", "qr", "code", "google", "review", "avis"] },
  { targetType: "landing" as const, path: "/features", label: "features", keywords: ["feature", "fonctionnalit", "analytics", "link"] },
  { targetType: "blog" as const, path: "/blog", label: "blog", keywords: ["guide", "blog", "astuce", "tips"] },
] as const;

/** Light stemmer: strip common English/French plural suffixes. */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("ies") && word.length > 5) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) {
    const base = word.slice(0, -2);
    if (/(ch|sh|s|x|z)$/.test(base)) return base; // boxes→box, wishes→wish
  }
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Tokenize a string into normalized word stems. */
export function tokenize(text: string): string[] {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "for", "with", "about", "your", "how", "why",
    "le", "la", "les", "de", "des", "du", "un", "une", "pour", "avec", "sur", "et",
    "au", "aux", "qui", "que", "vous", "plus", "get", "to", "of", "in", "on", "at",
    "by", "as", "is", "it", "be", "are", "this", "that", "from",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .map(stem)
    .filter((w) => w.length >= 3 && !stopwords.has(w));
}

/** Jaccard similarity between two token sets. */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

/** Extract a sensible anchor from the body for a given target phrase. */
export function extractAnchor(bodyMarkdown: string, phrase: string): string {
  const clean = bodyMarkdown.replace(/[#>*_\-~`\[\]]/g, " ");
  const sentences = clean.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(phrase.toLowerCase())) {
      const words = sentence.split(/\s+/);
      let anchor = words.length <= 14 ? sentence : words.slice(0, 14).join(" ");
      if (anchor.length > 60) {
        anchor = anchor.slice(0, 57).trimEnd() + "…";
      }
      return anchor;
    }
  }
  return phrase.slice(0, 60);
}

/** Rank canonical Revuvia pages that are topically relevant to the article. */
export function suggestCanonicalLinks(input: LinkingInput): InternalLinkSuggestion[] {
  const bodyTokens = new Set(tokenize(`${input.title} ${input.bodyMarkdown} ${input.primaryKeyword ?? ""}`));
  const suggestions: InternalLinkSuggestion[] = [];
  const baseUrl = input.appUrl ?? "";

  for (const page of CANONICAL_PAGES) {
    const pageTokens = tokenize(page.keywords.join(" "));
    const hits = pageTokens.filter((t) => bodyTokens.has(t));
    if (hits.length >= 1) {
      suggestions.push({
        targetType: page.targetType,
        targetUrl: `${baseUrl}${page.path}`,
        anchorText: extractAnchor(input.bodyMarkdown, page.label),
        rationale: `Canonical ${page.label} page relevant to this article (${hits.length} keyword matches)`,
        score: Math.round(Math.min(hits.length, 5) * 20),
      });
    }
  }

  return suggestions;
}

/** Rank related published articles by topical similarity. */
export function suggestArticleLinks(
  input: LinkingInput,
  articles: LinkableArticle[]
): InternalLinkSuggestion[] {
  const sourceTokens = tokenize(`${input.title} ${input.primaryKeyword ?? ""} ${(input.tags ?? []).join(" ")}`);
  const baseUrl = input.appUrl ?? "";

  const scored = articles.map((article) => {
    const targetTokens = tokenize(
      `${article.title} ${(article.tags ?? []).join(" ")} ${article.keywords?.join(" ") ?? ""} ${article.excerpt ?? ""}`
    );
    const similarity = jaccard(sourceTokens, targetTokens);
    return { article, similarity };
  });

  return scored
    .filter(({ similarity }) => similarity >= 0.08)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map(({ article, similarity }) => ({
      targetType: "article" as const,
      targetUrl: `${baseUrl}/${article.slug}`,
      anchorText: extractAnchor(input.bodyMarkdown, article.title.split(" ").slice(0, 4).join(" ")),
      rationale: `Related article "${article.title}" (similarity ${(similarity * 100).toFixed(0)}%)`,
      score: Math.round(similarity * 100),
    }));
}

/** Full internal link plan: canonical pages + related articles, ranked. */
export function buildInternalLinkPlan(input: LinkingInput): InternalLinkSuggestion[] {
  const canonical = suggestCanonicalLinks(input);
  const articles = suggestArticleLinks(input, input.publishedArticles ?? []);
  return [...canonical, ...articles]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

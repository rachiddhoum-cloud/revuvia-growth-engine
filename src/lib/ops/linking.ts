/**
 * Auto internal linking — Sprint 4, Phase 2.
 *
 * After each generation cycle, analyzes the article set and produces the
 * optimized internal linking plan: contextual links between pages that share
 * keywords, orphan detection (no incoming links), and missing contextual
 * link coverage. Deterministic; suggestions persist into `internal_links`.
 */

import type { ArticleRef, InternalLinkingPlan, LinkingSuggestion } from "@/lib/ops/types";

const STOPWORDS = new Set([
  "les", "des", "une", "pour", "avec", "dans", "sur", "par", "est", "sont", "the",
  "and", "for", "with", "your", "from", "that", "this", "how", "why", "what",
  "qui", "que", "pas", "plus", "aux", "du", "de", "la", "le", "se", "sa", "ce",
  "ces", "vous", "nous", "ils", "elle", "avoir", "faire", "vs", "et", "ou",
]);

/** Split a title into meaningful keyword tokens (lowercase, sorted). */
export function keywordTokens(title: string): string[] {
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[^a-zà-ÿ0-9\s-]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    )
  ).sort();
}

export interface LinkedArticle extends ArticleRef {
  tokens: string[];
}

/** Shared keyword count between two articles (0 when none). */
export function sharedTokens(a: LinkedArticle, b: LinkedArticle): string[] {
  const setB = new Set(b.tokens);
  return a.tokens.filter((t) => setB.has(t));
}

/**
 * Build the internal linking plan for a set of articles.
 * Each article gets up to `maxLinksPerPage` contextual suggestions (top
 * shared-keyword matches, deterministic tie-break by title). Orphans are
 * articles with zero incoming suggestions.
 */
export function analyzeInternalLinks(
  articles: ArticleRef[],
  maxLinksPerPage = 2
): InternalLinkingPlan {
  const linked: LinkedArticle[] = articles.map((a) => ({ ...a, tokens: keywordTokens(a.title) }));
  const incomingCount = new Map<string, number>(linked.map((a) => [a.id, 0]));

  const suggestions: LinkingSuggestion[] = [];

  for (const source of linked) {
    const candidates = linked
      .filter((target) => target.id !== source.id)
      .map((target) => {
        const shared = sharedTokens(source, target);
        return { target, shared };
      })
      .filter((c) => c.shared.length > 0)
      .sort(
        (a, b) =>
          b.shared.length - a.shared.length ||
          a.target.title.localeCompare(b.target.title) ||
          a.target.id.localeCompare(b.target.id)
      )
      .slice(0, maxLinksPerPage);

    for (const { target, shared } of candidates) {
      const anchor = shared.sort()[0];
      suggestions.push({
        sourceId: source.id,
        sourceTitle: source.title,
        targetId: target.id,
        targetTitle: target.title,
        anchor,
        reason: `Shares keyword "${anchor}" with "${target.title}"`,
      });
      incomingCount.set(target.id, (incomingCount.get(target.id) ?? 0) + 1);
    }
  }

  const orphans = linked
    .filter((a) => (incomingCount.get(a.id) ?? 0) === 0)
    .map(({ id, title }) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const coveragePct =
    linked.length === 0
      ? 0
      : Math.round((linked.filter((a) => (incomingCount.get(a.id) ?? 0) > 0).length / linked.length) * 100);

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    suggestions,
    orphans,
    coveragePct,
  };
}

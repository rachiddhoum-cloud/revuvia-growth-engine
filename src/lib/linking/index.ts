/**
 * Internal Linking Engine — barrel.
 */

export {
  buildInternalLinkPlan,
  suggestCanonicalLinks,
  suggestArticleLinks,
  extractAnchor,
  jaccard,
  tokenize,
  CANONICAL_PAGES,
} from "@/lib/linking/engine";
export type { LinkingInput, LinkableArticle } from "@/lib/linking/engine";

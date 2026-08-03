/**
 * Content Quality AI — barrel.
 */

export {
  scoreContent,
  scoreReadability,
  scoreStructure,
  scoreTitleQuality,
  scoreMetaQuality,
  scoreKeywordDensity,
  scoreCtaQuality,
  scoreOriginality,
  scoreSeoQuality,
  scoreAiConfidence,
  QUALITY_PASS_THRESHOLD,
  QUALITY_WEIGHTS,
} from "@/lib/quality/scorer";
export type { QualityInput } from "@/lib/quality/scorer";

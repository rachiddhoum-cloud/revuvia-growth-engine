/**
 * Weekly self-improvement — Sprint 8, Phase 7.
 *
 * Every Monday the learning cycle answers: what did I learn, what should I
 * stop doing, what should I do more of. Deterministic and markdown-ready.
 */

import type { Failure, LearningInsights, SuccessPattern } from "@/lib/learning/types";
import { humanizeKey } from "@/lib/learning/confidence";

export interface InsightsInput {
  weekStart: string;
  patterns: SuccessPattern[];
  failures: Failure[];
}

/** Lessons extracted from the strongest patterns (learned). */
export function learnedLessons(patterns: SuccessPattern[], limit = 4): string[] {
  return patterns
    .filter((p) => p.upliftPct >= 15)
    .slice(0, limit)
    .map(
      (p) =>
        `${humanizeKey(p.key)} ${p.strategyType.replace("_", " ")} outperforms the average by ${p.upliftPct}% (${p.samples} samples).`
    );
}

/** Actions to stop, derived from failures (stopDoing). */
export function stopDoingLessons(failures: Failure[], limit = 4): string[] {
  return failures.slice(0, limit).map((f) => `${humanizeKey(f.target)}: ${f.correctiveAction}`);
}

/** Strategies to double down on (doMore). */
export function doMoreLessons(patterns: SuccessPattern[], limit = 4): string[] {
  return patterns
    .filter((p) => p.upliftPct >= 15)
    .slice(0, limit)
    .map((p) => `Keep using ${humanizeKey(p.key)} (${p.upliftPct}% uplift, confidence-driven).`);
}

export function buildLearningInsights(input: InsightsInput): LearningInsights {
  const learned = learnedLessons(input.patterns);
  const stopDoing = stopDoingLessons(input.failures);
  const doMore = doMoreLessons(input.patterns);
  if (learned.length === 0 && doMore.length === 0) {
    learned.push("Not enough historical data yet — keep executing and the knowledge base will grow.");
  }
  return {
    weekStart: input.weekStart,
    learned,
    stopDoing,
    doMore,
    patterns: input.patterns.slice(0, 8),
    failures: input.failures.slice(0, 8),
  };
}

/** Render the insights report as markdown. */
export function insightsToMarkdown(insights: LearningInsights): string {
  return [
    `# Weekly self-improvement — ${insights.weekStart}`,
    "",
    "## What did I learn last week?",
    ...insights.learned.map((l) => `- ${l}`),
    "",
    "## What should I stop doing?",
    ...(insights.stopDoing.length > 0 ? insights.stopDoing.map((s) => `- ${s}`) : ["- Nothing urgent."]),
    "",
    "## What should I do more?",
    ...(insights.doMore.length > 0 ? insights.doMore.map((d) => `- ${d}`) : ["- Nothing above baseline yet."]),
    "",
    "## Success patterns detected",
    ...(insights.patterns.length > 0
      ? insights.patterns.map(
          (p) => `- [${p.strategyType}] ${humanizeKey(p.key)} — ${p.upliftPct >= 0 ? "+" : ""}${p.upliftPct}% uplift · ${p.samples} samples`
        )
      : ["- None yet."]),
    "",
    "## Failures detected",
    ...(insights.failures.length > 0
      ? insights.failures.map(
          (f) => `- **[${f.severity}] ${f.kind}** ${f.target}: ${f.detail}\n  → ${f.correctiveAction}`
        )
      : ["- None."]),
  ].join("\n");
}

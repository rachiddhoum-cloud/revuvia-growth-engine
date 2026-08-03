import { aiComplete, heavyModel, parseAiJson } from "@/lib/ai";
import { slugify } from "@/lib/utils";
import type { LeadMagnetKind, LeadMagnetOutput } from "@/types";

const SYSTEM = `You are a lead magnet specialist for Revuvia, a SaaS that helps local businesses
collect more Google reviews. You create downloadable, high-value lead magnets that
capture emails and nurture prospects into signups. Output valid JSON only.`;

const KIND_NOTES: Record<LeadMagnetKind, string> = {
  checklist: "actionable checklist with checkboxes, grouped into phases, under 2 pages",
  guide: "short guide 4-8 sections with practical steps, examples and a summary",
  template: "ready-to-use templates (e.g. WhatsApp message templates, QR placement plan) with fill-in blanks",
  ebook: "mini ebook 6-10 sections, chapter-style, value-dense, 1500+ words",
  worksheet: "worksheet with exercises, prompts and scoring/self-assessment",
  pdf: "polished one-pager: promise, 5-7 benefits, quick steps, CTA",
};

export interface LeadMagnetInput {
  topic: string;
  kind: LeadMagnetKind;
  audience?: string;
}

export async function generateLeadMagnet(input: LeadMagnetInput): Promise<LeadMagnetOutput> {
  const { topic, kind, audience } = input;

  const prompt = `Create a ${kind} lead magnet on the topic: "${topic}".

Target audience: ${audience ?? "local business owners who want more Google reviews"}.
Brand voice: practical, trustworthy, results-driven. It should attract and capture a lead,
then naturally funnel them to Revuvia (revuvia.com) — but the value must stand alone.

Requirements for a ${kind}:
- ${KIND_NOTES[kind]}
- contentMarkdown: complete ready-to-export markdown (with a title and sections)
- downloadFileName: a clean slug + extension suggestion

Return JSON:
{"kind":"${kind}","title":"catchy title","description":"1-2 sentence value promise","contentMarkdown":"...","downloadFileName":"e.g. google-reviews-checklist.pdf"}`;

  const result = await aiComplete(heavyModel(), {
    system: SYSTEM,
    prompt,
    responseFormat: "json",
    maxTokens: 8192,
    module: "leadmagnet",
  });
  const parsed = parseAiJson<Omit<LeadMagnetOutput, "kind">>(result.content);

  return {
    kind,
    title: parsed.title,
    description: parsed.description,
    contentMarkdown: parsed.contentMarkdown,
    downloadFileName: parsed.downloadFileName ?? `${slugify(topic)}-${kind}.pdf`,
  };
}

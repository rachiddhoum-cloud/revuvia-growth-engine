import { aiComplete, fastModel, parseAiJson } from "@/lib/ai";
import type { GeneratedContent, SocialPostOutput, SocialPlatform } from "@/types";

const SYSTEM = `You are a social media growth expert for Revuvia, a SaaS helping local businesses
collect more Google reviews. You adapt SEO articles into platform-native posts that
drive traffic, engagement and signups. Output valid JSON only.`;

const PLATFORM_NOTES: Record<SocialPlatform, string> = {
  linkedin: "professional tone, 1300-1800 chars, hook line + value bullets + soft CTA + 3-5 hashtags",
  facebook: "conversational, 3-6 short paragraphs, question to drive comments, 2-4 hashtags",
  instagram: "caption 1200-2200 chars, hook first line, emojis, line breaks, 8-12 hashtags, call to save/share",
  x: "max 280 chars, punchy, one clear idea, 2-3 hashtags, space for a visual",
  email: "newsletter format: subject line, preview text, intro, 3 sections, CTA button, sign-off",
  video: "short-form video script (30-60s): hook 0-3s, 3 key points, CTA, captions/on-screen text notes",
  whatsapp: "personal broadcast message, casual warm tone, under 600 chars, value + soft CTA, emojis ok, no hashtags",
};

export async function transformToSocial(
  content: Pick<GeneratedContent, "title" | "excerpt" | "bodyMarkdown">,
  platforms: SocialPlatform[]
): Promise<SocialPostOutput[]> {
  const results: SocialPostOutput[] = [];

  for (const platform of platforms) {
    const output = await aiComplete(fastModel(), {
      system: SYSTEM,
      prompt: `Turn this SEO article into a ${platform.toUpperCase()} post.

ARTICLE TITLE: ${content.title}
EXCERPT: ${content.excerpt}
BODY:
${content.bodyMarkdown.slice(0, 3000)}

${PLATFORM_NOTES[platform]}

Return JSON: {"body": "the post text", "hashtags": ["#tag1", "#tag2"]}`,
      responseFormat: "json",
      maxTokens: 2048,
      module: "social",
    });
    const parsed = parseAiJson<{ body: string; hashtags?: string[] }>(output.content);
    results.push({ platform, body: parsed.body, hashtags: parsed.hashtags });
  }

  return results;
}

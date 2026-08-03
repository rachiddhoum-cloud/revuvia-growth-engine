/**
 * Social Repurposing — Phase 4.
 *
 * Deterministically turns a published article into platform-native posts for
 * LinkedIn, X (Twitter), Facebook, Instagram, WhatsApp and Email. Pure string
 * processing (no AI calls) so it is fast, cheap and fully unit-testable.
 */

import type { CtaConfig, SocialPlatform, SocialPostOutput } from "@/types";

export interface RepurposeArticle {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  tags?: string[];
  cta?: CtaConfig;
  /** Absolute URL of the published article. */
  url?: string;
}

export interface RepurposeOptions {
  /** @default ["linkedin","x","facebook","instagram","whatsapp","email"] */
  platforms?: SocialPlatform[];
  /** Link appended to CTA copy (e.g. short link). Falls back to `article.url`. */
  link?: string;
}

export const REPURPOSE_PLATFORMS: SocialPlatform[] = [
  "linkedin",
  "x",
  "facebook",
  "instagram",
  "whatsapp",
  "email",
];

const LIMITS: Record<SocialPlatform, number> = {
  linkedin: 1800,
  facebook: 5000,
  instagram: 2200,
  x: 280,
  email: 5000,
  video: 5000,
  whatsapp: 600,
};

const DEFAULT_CTA: CtaConfig = {
  label: "Read the full guide",
  href: "",
  tone: "primary",
  position: "bottom",
};

/** Strip common markdown so counts and output are clean plain text. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** First sentence as an attention-grabbing hook. */
export function extractHook(bodyMarkdown: string): string {
  const text = stripMarkdown(bodyMarkdown);
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence.trim() || text.slice(0, 140);
}

/** First sentence that contains a number, statistic or concrete claim — best hook. */
export function extractStat(bodyMarkdown: string): string | null {
  const text = stripMarkdown(bodyMarkdown);
  const sentences = text.split(/(?<=[.!?])\s+/);
  const stat = sentences.find((s) => /\d/.test(s) && s.length >= 20 && s.length <= 240);
  return stat ?? null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function linkFor(options: RepurposeOptions, article: RepurposeArticle): string | null {
  return options.link ?? article.url ?? null;
}

function ctaLine(options: RepurposeOptions, article: RepurposeArticle, label?: string): string {
  const link = linkFor(options, article);
  const text = label ?? article.cta?.label ?? DEFAULT_CTA.label;
  return link ? `${text}: ${link}` : text;
}

function hashtagFromTag(tag: string): string {
  const cleaned = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned ? `#${cleaned}` : "";
}

export function buildHashtags(article: Pick<RepurposeArticle, "tags">, extra: string[] = [], max = 5): string[] {
  const fromTags = (article.tags ?? []).map(hashtagFromTag).filter((t): t is string => t !== "");
  const merged = [...fromTags, ...extra.map(hashtagFromTag)].filter(Boolean);
  return [...new Set(merged)].slice(0, max);
}

/** Extract 2-4 key takeaways from the body (bulleted short sentences). */
export function extractTakeaways(bodyMarkdown: string, max = 3): string[] {
  const text = stripMarkdown(bodyMarkdown);
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.filter((s) => s.length >= 15 && s.length <= 200).slice(0, max);
}

/** Split the plain body into short, platform-friendly paragraphs. */
export function paragraphize(text: string, maxLength = 220): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > maxLength) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.length > 0 ? paragraphs : [text];
}

function hookPost(article: RepurposeArticle): string {
  const stat = extractStat(article.bodyMarkdown);
  if (stat) return stat;
  return extractHook(article.bodyMarkdown);
}

function xPost(article: RepurposeArticle, options: RepurposeOptions): string {
  const body = truncate(hookPost(article), 260);
  const cta = ctaLine(options, article);
  const hashtags = buildHashtags(article, ["seo"], 3).join(" ");
  const parts = [body, cta, hashtags].filter(Boolean);
  return truncate(parts.join(" "), LIMITS.x);
}

function linkedinPost(article: RepurposeArticle, options: RepurposeOptions): string {
  const body = hookPost(article);
  const takeaways = extractTakeaways(article.bodyMarkdown, 3).map((t) => `• ${t}`);
  const cta = ctaLine(options, article);
  const hashtags = buildHashtags(article, ["growth"], 4).join(" ");
  const parts = [body, "", ...takeaways, "", cta, hashtags].filter(Boolean);
  return truncate(parts.join("\n"), LIMITS.linkedin);
}

function facebookPost(article: RepurposeArticle, options: RepurposeOptions): string {
  const hook = hookPost(article);
  const paragraphs = paragraphize(stripMarkdown(article.bodyMarkdown), 200);
  const question = `Have you tried ${article.excerpt ? article.excerpt.slice(0, 80).toLowerCase() : "this"}? Share your experience below.`;
  const cta = ctaLine(options, article);
  const hashtags = buildHashtags(article, [], 3).join(" ");
  const parts = [hook, "", ...paragraphs.slice(0, 3), "", question, cta, hashtags].filter(Boolean);
  return truncate(parts.join("\n"), LIMITS.facebook);
}

function instagramPost(article: RepurposeArticle, options: RepurposeOptions): string {
  const hook = hookPost(article);
  const paragraphs = paragraphize(stripMarkdown(article.bodyMarkdown), 160);
  const cta = `Save this post for later, share it with a friend, and check the link in bio! ${linkFor(options, article) ?? ""}`.trim();
  const hashtags = buildHashtags(article, ["tips", "growth"], 10).join(" ");
  const parts = [hook, "", ...paragraphs.slice(0, 4), "", cta, hashtags].filter(Boolean);
  return truncate(parts.join("\n"), LIMITS.instagram);
}

function whatsappPost(article: RepurposeArticle, options: RepurposeOptions): string {
  const body = hookPost(article);
  const cta = ctaLine(options, article);
  const parts = [body, "", cta, "Forward this to someone who needs it 🤝"].filter(Boolean);
  return truncate(parts.join("\n"), LIMITS.whatsapp);
}

function emailPost(article: RepurposeArticle, options: RepurposeOptions): string {
  const hook = hookPost(article);
  const takeaways = extractTakeaways(article.bodyMarkdown, 3).map((t) => `• ${t}`);
  const cta = ctaLine(options, article, article.cta?.label ?? "Read the full article");
  const signOff = "Talk soon,\nThe Revuvia Team";
  const parts = [hook, "", "Here are the highlights:", "", ...takeaways, "", cta, "", signOff].filter(Boolean);
  return truncate(parts.join("\n"), LIMITS.email);
}

const BUILDERS: Partial<Record<SocialPlatform, (a: RepurposeArticle, o: RepurposeOptions) => string>> = {
  linkedin: linkedinPost,
  x: xPost,
  facebook: facebookPost,
  instagram: instagramPost,
  whatsapp: whatsappPost,
  email: emailPost,
};

/** Deterministically build native posts for the requested platforms. */
export function repurposeArticle(article: RepurposeArticle, options: RepurposeOptions = {}): SocialPostOutput[] {
  const platforms = options.platforms ?? REPURPOSE_PLATFORMS;
  const seen = new Set<SocialPlatform>();
  const posts: SocialPostOutput[] = [];

  for (const platform of platforms) {
    const builder = BUILDERS[platform];
    if (!builder || seen.has(platform)) continue;
    seen.add(platform);
    const body = builder(article, options);
    const hashtags = /#\w+/.test(body) ? [] : buildHashtags(article, ["seo"], 5);
    posts.push({ platform, body, hashtags });
  }

  return posts;
}

export function repurposeToPosts(
  article: RepurposeArticle,
  platforms: SocialPlatform[]
): SocialPostOutput[] {
  return repurposeArticle(article, { platforms });
}

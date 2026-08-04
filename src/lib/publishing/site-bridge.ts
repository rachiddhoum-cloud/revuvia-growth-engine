import "server-only";

import { logger } from "@/lib/log/logger";
import { blogPostUrl } from "@/lib/publishing/site-config";
import type { SitePublishPayload, SitePublishResult } from "@/lib/publishing/types";

export interface BridgeArticleInput {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body_markdown?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
  published_at?: string | null;
  cover_url?: string | null;
}

function buildPayload(article: BridgeArticleInput): SitePublishPayload {
  const canonicalUrl = blogPostUrl(article.slug);
  const publishedAt = article.published_at ?? new Date().toISOString();
  return {
    action: "publish",
    canonicalUrl,
    article: {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt ?? null,
      bodyMarkdown: article.body_markdown ?? "",
      metaTitle: article.meta_title ?? null,
      metaDescription: article.meta_description ?? null,
      tags: article.tags ?? [],
      publishedAt,
      canonicalUrl,
      coverUrl: article.cover_url ?? null,
    },
  };
}

/**
 * Notify the marketing site (reputation-link-builder) when an article is published.
 * Skips cleanly when BLOG_PUBLISH_WEBHOOK_URL is unset.
 */
export async function pushArticleToMarketingSite(article: BridgeArticleInput): Promise<SitePublishResult> {
  const canonicalUrl = blogPostUrl(article.slug);
  const webhookUrl = process.env.BLOG_PUBLISH_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: true, canonicalUrl, webhookAttempted: false, webhookOk: false };
  }

  const payload = buildPayload(article);
  const secret = process.env.BLOG_PUBLISH_WEBHOOK_SECRET?.trim();

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const message = `Webhook ${response.status}: ${body.slice(0, 200)}`;
      logger.error("blog.site_bridge webhook failed", { slug: article.slug, error: message });
      return { ok: false, canonicalUrl, webhookAttempted: true, webhookOk: false, error: message };
    }

    logger.info("blog.site_bridge webhook ok", { slug: article.slug, canonicalUrl });
    return { ok: true, canonicalUrl, webhookAttempted: true, webhookOk: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("blog.site_bridge webhook error", { slug: article.slug, error: message });
    return { ok: false, canonicalUrl, webhookAttempted: true, webhookOk: false, error: message };
  }
}

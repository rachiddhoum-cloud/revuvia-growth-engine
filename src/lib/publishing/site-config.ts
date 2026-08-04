/**
 * Canonical Revuvia marketing site URLs for blog posts and social links.
 */

const DEFAULT_SITE_URL = "https://revuvia.com";

/** Public marketing site origin (no trailing slash). */
export function getRevuviaSiteUrl(): string {
  const raw = process.env.REVUVIA_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

/** Canonical public URL for a blog article on the marketing site. */
export function blogPostUrl(slug: string): string {
  const clean = slug.trim().replace(/^\/+/, "");
  return `${getRevuviaSiteUrl()}/blog/${clean}`;
}

/** Growth Engine hosted blog path (for Vercel rewrites from revuvia.com/blog). */
export function growthEngineBlogPath(slug?: string): string {
  if (!slug) return "/blog";
  return `/blog/${slug.trim().replace(/^\/+/, "")}`;
}

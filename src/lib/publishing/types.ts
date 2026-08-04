export interface PublicBlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMarkdown: string;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: string[];
  publishedAt: string | null;
  canonicalUrl: string;
  coverUrl: string | null;
}

export interface SitePublishPayload {
  action: "publish";
  canonicalUrl: string;
  article: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    bodyMarkdown: string;
    metaTitle: string | null;
    metaDescription: string | null;
    tags: string[];
    publishedAt: string;
    canonicalUrl: string;
    coverUrl: string | null;
  };
}

export interface SitePublishResult {
  ok: boolean;
  canonicalUrl: string;
  webhookAttempted: boolean;
  webhookOk: boolean;
  error?: string;
}

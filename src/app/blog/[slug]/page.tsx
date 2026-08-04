import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Metadata } from "next";

import { loadPublicBlogArticleBySlug } from "@/lib/publishing/public-blog";
import { blogPostUrl, getRevuviaSiteUrl } from "@/lib/publishing/site-config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadPublicBlogArticleBySlug(slug);
  if (!article) return { title: "Article not found" };

  const title = article.metaTitle ?? article.title;
  const description = article.metaDescription ?? article.excerpt ?? undefined;
  const canonical = blogPostUrl(article.slug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      publishedTime: article.publishedAt ?? undefined,
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await loadPublicBlogArticleBySlug(slug);
  if (!article) notFound();

  const siteUrl = getRevuviaSiteUrl();
  const canonical = blogPostUrl(article.slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="space-y-1">
            <Link href="/blog" className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-primary">
              Revuvia Blog
            </Link>
            <p className="text-xs text-muted-foreground">
              Canonical:{" "}
              <a href={canonical} className="hover:text-primary">{canonical}</a>
            </p>
          </div>
          <Link href={siteUrl} className="text-sm text-primary hover:underline">
            Try Revuvia →
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
          {article.publishedAt ? (
            <p className="text-sm text-muted-foreground">
              {new Date(article.publishedAt).toLocaleDateString()}
            </p>
          ) : null}
          {article.excerpt ? (
            <p className="text-base leading-relaxed text-muted-foreground">{article.excerpt}</p>
          ) : null}
        </header>

        <div className="prose prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary">
          <ReactMarkdown>{article.bodyMarkdown}</ReactMarkdown>
        </div>

        <footer className="mt-12 rounded-lg border border-primary/20 bg-primary/5 p-6">
          <p className="text-sm font-medium">Grow with Revuvia</p>
          <p className="mt-1 text-sm text-muted-foreground">
            QR codes, Google reviews and reputation tools for restaurants.
          </p>
          <Link
            href={`${siteUrl}/register`}
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Start free trial →
          </Link>
        </footer>
      </article>
    </div>
  );
}

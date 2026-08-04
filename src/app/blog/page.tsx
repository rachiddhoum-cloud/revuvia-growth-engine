import Link from "next/link";

import { loadPublicBlogArticles } from "@/lib/publishing/public-blog";
import { getRevuviaSiteUrl } from "@/lib/publishing/site-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog",
  description: "SEO guides and growth playbooks for restaurants and local businesses — Revuvia.",
};

export default async function BlogIndexPage() {
  const articles = await loadPublicBlogArticles();
  const siteUrl = getRevuviaSiteUrl();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revuvia</p>
            <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          </div>
          <Link
            href={siteUrl}
            className="text-sm text-primary hover:underline"
          >
            revuvia.com →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published articles yet. Approve content in Growth Engine to populate this feed.
          </p>
        ) : (
          <ul className="space-y-8">
            {articles.map((article) => (
              <li key={article.id} className="border-b border-border/50 pb-8 last:border-0">
                <Link href={`/blog/${article.slug}`} className="group block space-y-2">
                  <h2 className="text-xl font-semibold group-hover:text-primary">{article.title}</h2>
                  {article.excerpt ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{article.excerpt}</p>
                  ) : null}
                  {article.publishedAt ? (
                    <p className="text-xs text-muted-foreground">
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

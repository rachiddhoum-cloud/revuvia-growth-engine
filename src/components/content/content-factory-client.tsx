"use client";

import * as React from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { FileText, Loader2, Sparkles, Wand2, Copy, Check, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GeneratedContent, SocialPostOutput, SocialPlatform } from "@/types";

const PLATFORMS: SocialPlatform[] = ["linkedin", "facebook", "instagram", "x", "email", "video"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function ContentFactoryClient() {
  const [keyword, setKeyword] = React.useState("");
  const [kind, setKind] = React.useState<"article" | "landing" | "faq">("article");
  const [audience, setAudience] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [content, setContent] = React.useState<GeneratedContent | null>(null);
  const [social, setSocial] = React.useState<SocialPostOutput[]>([]);
  const [socialLoading, setSocialLoading] = React.useState(false);

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), kind, audience: audience.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed");
      }
      const data = (await res.json()) as { content: GeneratedContent };
      setContent(data.content);
      setSocial([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateSocial() {
    if (!content) return;
    setSocialLoading(true);
    try {
      const res = await fetch("/api/content/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: content.title, excerpt: content.excerpt, bodyMarkdown: content.bodyMarkdown, platforms: PLATFORMS }),
      });
      if (!res.ok) throw new Error("Social generation failed");
      const data = (await res.json()) as { posts: SocialPostOutput[] };
      setSocial(data.posts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Social generation failed");
    } finally {
      setSocialLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content Factory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One keyword → full SEO asset (article, landing or FAQ) with meta, JSON-LD and CTA, then
          transform it into 6 social posts.
        </p>
      </div>

      <form onSubmit={generate} className="space-y-3 rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div>
            <Label htmlFor="ckw">Keyword</Label>
            <Input
              id="ckw"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. QR code Google avis restaurant"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ckind">Output type</Label>
            <select
              id="ckind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="article">SEO article</option>
              <option value="landing">Landing page</option>
              <option value="faq">FAQ page</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="caud">Audience (optional)</Label>
          <Input
            id="caud"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. coffee shop owners in Casablanca"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" disabled={loading || !keyword.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? "Generating…" : "Generate content"}
        </Button>
      </form>

      {content && (
        <Tabs defaultValue="article">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="article">Article</TabsTrigger>
            <TabsTrigger value="meta">Meta & SEO</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="social">Social posts</TabsTrigger>
          </TabsList>

          <TabsContent value="article" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" /> {content.title}
                  </CardTitle>
                  <CardDescription className="mt-1">{content.excerpt}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{content.kind}</Badge>
                  <CopyButton text={content.bodyMarkdown} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                  <ReactMarkdown>{content.bodyMarkdown}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meta" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Meta title</p>
                  <p className="mt-1 rounded-lg border bg-muted/30 p-3 font-mono text-sm">
                    {content.metaTitle}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Meta description</p>
                  <p className="mt-1 rounded-lg border bg-muted/30 p-3 font-mono text-sm">
                    {content.metaDescription}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Featured snippet</p>
                  <p className="mt-1 rounded-lg border bg-muted/30 p-3 text-sm">{content.featuredSnippet}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Tags</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {content.tags.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">JSON-LD</p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(content.jsonLd, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">CTA</p>
                  <p className="mt-1 text-sm">
                    <Badge variant="success">{content.cta.label}</Badge>{" "}
                    <span className="font-mono text-muted-foreground">{content.cta.href}</span> ·{" "}
                    {content.cta.position}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                {content.faqs.map((faq, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <p className="font-medium">{faq.question}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Transform this article into native posts.</p>
              <Button onClick={generateSocial} disabled={socialLoading} size="sm">
                {socialLoading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {socialLoading ? "Transforming…" : "Generate all"}
              </Button>
            </div>
            {social.length > 0 && (
              <div className="space-y-4">
                {social.map((post) => (
                  <Card key={post.platform}>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm capitalize">
                        <RefreshCw className="size-3.5 text-primary" /> {post.platform}
                      </CardTitle>
                      <CopyButton text={post.body} />
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <p className="mt-3 text-xs text-primary">{post.hashtags.join(" ")}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

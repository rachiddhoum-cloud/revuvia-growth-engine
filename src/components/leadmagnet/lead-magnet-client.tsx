"use client";

import * as React from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Loader2, Magnet, Sparkles, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LeadMagnetKind, LeadMagnetOutput } from "@/types";

const KINDS: { value: LeadMagnetKind; label: string; icon: string }[] = [
  { value: "checklist", label: "Checklist", icon: "✓" },
  { value: "guide", label: "Guide", icon: "📘" },
  { value: "template", label: "Template", icon: "📋" },
  { value: "ebook", label: "Mini ebook", icon: "📖" },
  { value: "worksheet", label: "Worksheet", icon: "✎" },
  { value: "pdf", label: "One-pager PDF", icon: "📄" },
];

export function LeadMagnetClient() {
  const [topic, setTopic] = React.useState("plus d'avis Google pour mon restaurant");
  const [kind, setKind] = React.useState<LeadMagnetKind>("checklist");
  const [audience, setAudience] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState<LeadMagnetOutput | null>(null);

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lead-magnets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), kind, audience: audience.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed");
      }
      const data = (await res.json()) as { output: LeadMagnetOutput };
      setOutput(data.output);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadMarkdown() {
    if (!output) return;
    const blob = new Blob([output.contentMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = output.downloadFileName.replace(/\.pdf$/, ".md");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead Magnet Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produce downloadable assets that capture emails and nurture prospects into Revuvia users.
        </p>
      </div>

      <form onSubmit={generate} className="space-y-4 rounded-xl border p-4">
        <div>
          <Label htmlFor="lm-topic">Topic</Label>
          <Input
            id="lm-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. how to get 100 Google reviews in 30 days"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Format</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors ${
                  kind === k.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
              >
                <span className="text-base">{k.icon}</span>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="lm-audience">Audience (optional)</Label>
          <Input
            id="lm-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. dental clinic managers"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" disabled={loading || !topic.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? "Generating…" : "Generate lead magnet"}
        </Button>
      </form>

      {output && (
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Magnet className="size-4 text-primary" /> {output.title}
              </CardTitle>
              <CardDescription className="mt-1">{output.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{output.kind}</Badge>
              <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                <Download className="size-3.5" /> .md
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <ReactMarkdown>{output.contentMarkdown}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

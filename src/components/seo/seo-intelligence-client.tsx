"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search, Loader2, Sparkles, TrendingUp, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { SeoOpportunityReport, AnalyzedKeyword } from "@/types";

function IntentBadge({ intent }: { intent: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    informational: { label: "Informational", cls: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    commercial: { label: "Commercial", cls: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    transactional: { label: "Transactional", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    navigational: { label: "Navigational", cls: "border-muted bg-muted/40 text-muted-foreground" },
  };
  const m = map[intent] ?? map.navigational;
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function difficultyColor(value: number) {
  if (value < 35) return "text-emerald-500";
  if (value < 65) return "text-amber-500";
  return "text-red-500";
}

export function SeoIntelligenceClient() {
  const [seed, setSeed] = React.useState("obtenir plus d'avis google");
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState<SeoOpportunityReport | null>(null);

  async function runAnalysis(e?: React.FormEvent) {
    e?.preventDefault();
    if (!seed.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: seed.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Analysis failed");
      }
      const data = (await res.json()) as { report: SeoOpportunityReport };
      setReport(data.report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SEO Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Expand a seed keyword into a ranked list of SEO opportunities with intent, difficulty and
          opportunity scores.
        </p>
      </div>

      <form onSubmit={runAnalysis} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="seed">Seed keyword</Label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="seed"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="e.g. more Google reviews for cafés"
              className="pl-9"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading || !seed.trim()} className="h-9">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? "Analyzing…" : "Run analysis"}
        </Button>
      </form>

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {report.opportunities.length} opportunities
            </Badge>
            <Badge variant="secondary">{report.clusters.length} clusters</Badge>
            <Badge variant="secondary">
              Seed: <span className="font-mono">{report.seedKeyword}</span>
            </Badge>
          </div>

          {report.clusters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="size-4 text-primary" /> Clusters
                </CardTitle>
                <CardDescription>Semantic groups of related keywords.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {report.clusters.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-lg border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <IntentBadge intent={c.intent} />
                    </div>
                    <p className="mt-1 text-muted-foreground">{c.keywords.length} keywords</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TrendingUp className="size-4" /> Ranked opportunities
            </h2>
            {report.opportunities.map((kw: AnalyzedKeyword) => (
              <Card key={kw.keyword} className="gap-3 py-4">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                        {kw.priority}
                      </span>
                      <p className="truncate font-medium">{kw.keyword}</p>
                      <IntentBadge intent={kw.intent} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {kw.serpFeatures.map((f) => (
                        <span key={f} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {f.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-end">
                      <p className="text-xs text-muted-foreground">Volume</p>
                      <p className="font-semibold">{kw.volume.toLocaleString()}</p>
                    </div>
                    <div className="w-24 text-end">
                      <p className="text-xs text-muted-foreground">Difficulty</p>
                      <p className={`font-semibold ${difficultyColor(kw.difficulty)}`}>{kw.difficulty}</p>
                    </div>
                    <div className="w-28">
                      <p className="text-xs text-muted-foreground">Opportunity</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={kw.opportunityScore} className="h-1.5 flex-1" />
                        <span className="text-xs font-bold">{kw.opportunityScore}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {!report && !loading && (
        <Alert variant="default">
          <Sparkles />
          <AlertTitle>Ready when you are</AlertTitle>
          <AlertDescription>
            Enter a seed keyword above — the AI will expand it into clusters, estimate difficulty and
            rank opportunities by potential.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

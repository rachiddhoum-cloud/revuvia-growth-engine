"use client";

import * as React from "react";
import { TrendingUp, FileText, Search, Download, Users, Activity, CircleDollarSign, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart, type ChartPoint } from "@/components/dashboard/trend-chart";
import { displayVisits } from "@/lib/analytics/aggregate";
import type { AnalyticsModel } from "@/lib/analytics/aggregate";

const statusColor: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-600",
  ready: "bg-sky-500/15 text-sky-600",
  approved: "bg-violet-500/15 text-violet-600",
  queued: "bg-amber-500/15 text-amber-600",
  writing: "bg-blue-500/15 text-blue-600",
  quality: "bg-cyan-500/15 text-cyan-600",
  draft: "bg-slate-500/15 text-slate-600",
  idea: "bg-slate-400/15 text-slate-500",
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function SeoDashboardClient({ model }: { model: AnalyticsModel }) {
  const { summary, series, topPages, statusDistribution } = model;
  const traffic: ChartPoint[] = series.map((p) => ({ label: p.label, value: p.visits }));

  const hasData = summary.totalVisits > 0 || summary.publishedCount > 0;

  const stats = [
    { label: "Articles published", value: String(summary.publishedCount), icon: FileText },
    { label: "Organic visits (30d)", value: displayVisits(summary.totalVisits), icon: Users },
    { label: "Clicks", value: displayVisits(summary.totalClicks), icon: Search },
    { label: "Lead magnet downloads", value: String(summary.totalDownloads), icon: Download },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SEO Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organic traffic, rankings and conversion overview for your published content.
          </p>
        </div>
        {hasData && (
          <Badge variant="success">
            <TrendingUp className="size-3" /> Tracking active
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex-row items-center justify-between">
                <CardDescription className="text-xs font-medium">{stat.label}</CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <TrendChart data={traffic} title="Organic traffic" description="Daily organic visits over the last 30 days" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4 text-primary" /> Conversion rate
            </CardTitle>
            <CardDescription>Impressions → clicks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tracking-tight">
              {summary.ctr.toFixed(1)}
              <span className="text-lg text-muted-foreground">%</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.totalImpressions} impressions · {summary.totalConversions} conversions · $
              {summary.totalRevenue.toFixed(2)} revenue
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-primary" /> Content quality
            </CardTitle>
            <CardDescription>
              Avg score {summary.avgQualityScore.toFixed(0)}/100 across {summary.publishedCount + (0)} scored items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {summary.qualityBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className="flex-1 rounded-lg border p-3 text-center text-sm min-w-[90px]"
                >
                  <p className="text-2xl font-semibold tracking-tight">{bucket.count}</p>
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {summary.modules.map((m) => (
                <Badge key={m.module} variant="secondary">
                  {m.module} · {m.runs}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CircleDollarSign className="size-4 text-primary" /> AI engine
            </CardTitle>
            <CardDescription>Generation runs and spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-semibold tracking-tight">{summary.aiRuns}</p>
                <p className="text-xs text-muted-foreground">AI runs (30d)</p>
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight">${summary.aiCostUsd.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total AI cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top pages</CardTitle>
          </CardHeader>
          <CardContent>
            {topPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No page metrics yet — publish content and connect a ranking source to populate this view.
              </p>
            ) : (
              <div className="space-y-2">
                {topPages.map((page) => (
                  <div key={page.url} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span className="truncate font-mono text-xs">{page.url}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-muted-foreground">{page.visits} visits</span>
                      <span className="text-muted-foreground">{page.ctr.toFixed(1)}% CTR</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Content status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDistribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No content yet — run the growth pipeline to see status distribution.
              </p>
            ) : (
              <div className="space-y-2">
                {statusDistribution.map((entry) => (
                  <div key={entry.status} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span className={`capitalize ${statusColor[entry.status] ?? "bg-slate-500/15 text-slate-500"} rounded-md px-2 py-0.5 text-xs font-medium`}>
                      {statusLabel(entry.status)}
                    </span>
                    <span className="text-muted-foreground">{entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

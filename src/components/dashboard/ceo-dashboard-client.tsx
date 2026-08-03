"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Download,
  FileText,
  ListChecks,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart, type ChartPoint } from "@/components/dashboard/trend-chart";
import { displayVisits } from "@/lib/analytics/aggregate";
import type { CeoDashboardModel } from "@/lib/ops/dashboard-loader";
import type { ScoreDimension } from "@/lib/ops/types";

const PRIORITY_STYLE: Record<string, string> = {
  P0: "bg-red-500/15 text-red-600",
  P1: "bg-amber-500/15 text-amber-600",
  P2: "bg-slate-500/15 text-slate-600",
};

const SCORE_DIMENSIONS: { key: ScoreDimension; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "content", label: "Content" },
  { key: "traffic", label: "Traffic" },
  { key: "leads", label: "Leads" },
  { key: "conversion", label: "Conversion" },
  { key: "revenue", label: "Revenue" },
  { key: "execution", label: "Execution" },
];

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function CeoDashboardClient({ model }: { model: CeoDashboardModel }) {
  const { snapshot, latestPlan, latestScore, scoreHistory } = model;
  const { weekly, customers } = snapshot;

  const series: ChartPoint[] = snapshot.daily.map((d) => ({
    label: d.metric_date.slice(5, 10),
    value: d.organic_visits ?? 0,
  }));

  const hasData = weekly.visits > 0 || customers.paid > 0 || weekly.publishedCount > 0;

  const stats = [
    { label: "Weekly traffic", value: displayVisits(weekly.visits), hint: `~${displayVisits(snapshot.estimatedSeoTraffic)} est. SEO`, icon: BarChart3 },
    { label: "Generated leads", value: String(weekly.leads), hint: "lead-magnet downloads", icon: Download },
    { label: "New signups", value: String(weekly.signups), hint: "this week", icon: Users },
    { label: "Trial users", value: String(customers.trial), hint: "active trials", icon: Zap },
    { label: "Paid users", value: String(customers.paid), hint: `${customers.churned} churned`, icon: Users },
    { label: "Conversion rate", value: `${(snapshot.conversionRate * 100).toFixed(1)}%`, hint: "visits → signups", icon: Activity },
    { label: "MRR", value: `$${customers.mrrUsd.toFixed(2)}`, hint: "recurring revenue", icon: CircleDollarSign },
    { label: "Estimated SEO traffic", value: displayVisits(snapshot.estimatedSeoTraffic), hint: `${weekly.impressions} impressions`, icon: Search },
    { label: "AI costs", value: `$${weekly.aiCostUsd.toFixed(2)}`, hint: `${weekly.aiRuns} runs`, icon: Sparkles },
    { label: "Content published", value: String(weekly.publishedCount), hint: `avg quality ${snapshot.qualityAverage.toFixed(0)}/100`, icon: FileText },
  ];

  const tasksRemaining = latestPlan ? latestPlan.actions.length : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CEO Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The weekly state of Revuvia — traffic, revenue, execution. One screen, every Monday.
          </p>
        </div>
        {hasData && (
          <Badge variant="success">
            <TrendingUp className="size-3" /> Operational
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
        <StatCard
          label="Tasks remaining"
          value={String(tasksRemaining)}
          hint={latestPlan ? `week of ${latestPlan.weekStart}` : "generate the weekly plan"}
          icon={ListChecks}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <TrendChart data={series} title="Organic traffic" description="Daily organic visits this week" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="size-4 text-primary" /> Weekly action plan
            </CardTitle>
            <CardDescription>Top priorities, ranked by ICE</CardDescription>
          </CardHeader>
          <CardContent>
            {!latestPlan || latestPlan.actions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No plan yet — run the Monday generation to get your TOP 10 actions.
              </p>
            ) : (
              <div className="space-y-2">
                {latestPlan.actions.slice(0, 5).map((action) => (
                  <div key={action.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.kind} · +${action.mrrImpactUsd} MRR
                      </p>
                    </div>
                    <Badge className={PRIORITY_STYLE[action.priority] ?? ""}>{action.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GrowthScoreCard latestScore={latestScore} history={scoreHistory} />
    </div>
  );
}

function GrowthScoreCard({
  latestScore,
  history,
}: {
  latestScore: CeoDashboardModel["latestScore"];
  history: CeoDashboardModel["scoreHistory"];
}) {
  const scorePoints: ChartPoint[] = history.map((p) => ({
    label: p.date.slice(5, 10),
    value: p.total,
  }));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4 text-primary" /> Growth score
          </CardTitle>
          <CardDescription>One number, 7 dimensions, tracked over time</CardDescription>
        </div>
        {latestScore && (
          <Badge variant={latestScore.trend === "up" ? "success" : latestScore.trend === "down" ? "destructive" : "secondary"}>
            {latestScore.trend === "up" ? "▲" : latestScore.trend === "down" ? "▼" : "—"} {latestScore.trend}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {!latestScore ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No score yet — the Monday execution generates your first Growth Score.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-xl border p-4">
              <p className="text-5xl font-semibold tracking-tight">{latestScore.total}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latestScore.previousTotal !== null
                  ? `was ${latestScore.previousTotal} · ${latestScore.trend}`
                  : "first measurement"}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCORE_DIMENSIONS.map((dim) => {
                const value = latestScore.dimensions[dim.key];
                return (
                  <div key={dim.key} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground">{dim.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-medium">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {scorePoints.length > 1 && (
          <div className="mt-4">
            <TrendChart data={scorePoints} title="Score evolution" description="Weekly growth score" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

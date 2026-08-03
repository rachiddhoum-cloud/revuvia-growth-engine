"use client";

import type { ElementType } from "react";
import {
  BarChart3,
  DollarSign,
  Mail,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CasDashboardModel } from "@/lib/acquisition/types";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ElementType;
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

export function CasDashboardClient({ model }: { model: CasDashboardModel }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer Acquisition</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Traffic → leads → customers → MRR. One founder view for Revuvia growth.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Weekly traffic"
          value={String(model.traffic.weekly)}
          hint={`${model.traffic.deltaPct >= 0 ? "+" : ""}${model.traffic.deltaPct}% vs last week`}
          icon={BarChart3}
        />
        <StatCard
          label="Leads this week"
          value={String(model.leads.thisWeek)}
          hint={`${model.leads.conversionRate}% visitor → lead`}
          icon={Users}
        />
        <StatCard
          label="MRR generated"
          value={`$${model.revenue.mrrUsd}`}
          hint={`${model.revenue.paidCustomers} paid customer(s)`}
          icon={DollarSign}
        />
        <StatCard
          label="ROI estimate"
          value={`${model.revenue.roiEstimate}x`}
          hint={`CAC ~$${model.revenue.cacEstimateUsd}`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SEO Content Hub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{model.seo.keywords} keywords tracked</p>
            <p>{model.seo.pillars} pillar pages</p>
            <p>{model.seo.published} articles published</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="size-4" /> Email nurture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{model.email.sent} sent</p>
            <p>{model.email.openRate}% open rate</p>
            <p>{model.email.clickRate}% click rate</p>
            <p>{model.email.unsubscribeRate}% unsubscribe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="size-4" /> Lead totals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{model.leads.total} total leads captured</p>
            <p>{model.leads.thisWeek} this week</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard
          title="Top performing content"
          empty="Publish content with CTAs to track ROI."
          rows={model.topContent.map((c) => ({
            label: c.title,
            meta: `${c.leads} leads · $${c.mrrUsd} MRR`,
          }))}
        />
        <RankingCard
          title="Top performing CTAs"
          empty="Add CTAs to articles via Content Hub."
          rows={model.topCta.map((c) => ({
            label: c.label,
            meta: `${c.clicks} clicks · ${c.conversions} conversions`,
          }))}
        />
        <RankingCard
          title="Top channels"
          empty="Track journey events by channel."
          rows={model.topChannel.map((c) => ({
            label: c.channel,
            meta: `${c.conversions} conversions`,
          }))}
        />
      </div>
    </div>
  );
}

function RankingCard({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { label: string; meta: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MousePointerClick className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.label} className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{r.label}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {r.meta}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

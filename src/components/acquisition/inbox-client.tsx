"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FounderBriefing } from "@/lib/acquisition/types";

export function InboxClient({ briefing }: { briefing: FounderBriefing }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Founder Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {briefing.readMinutes}-minute morning briefing — {briefing.date}
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm">Yesterday</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <p>+{briefing.yesterday.visitors} visitors</p>
          <p>+{briefing.yesterday.leads} leads</p>
          <p>+{briefing.yesterday.paidCustomers} paid customer(s)</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <InsightCard label="Best article" value={briefing.bestArticle ?? "—"} />
        <InsightCard label="Worst funnel" value={briefing.worstFunnel ?? "—"} />
        <InsightCard label="Recommended action" value={briefing.recommendedAction} highlight />
        <InsightCard label="Highest ROI task today" value={briefing.highestRoiTask} highlight />
      </div>
    </div>
  );
}

function InsightCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-emerald-500/30" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {highlight ? (
          <Badge className="whitespace-normal text-left text-sm font-normal leading-snug">{value}</Badge>
        ) : (
          <p className="text-sm font-medium">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

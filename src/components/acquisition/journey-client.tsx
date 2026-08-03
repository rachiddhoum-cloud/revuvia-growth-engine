"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JourneyFunnelModel } from "@/lib/acquisition/journey";

export function JourneyClient({ model }: { model: JourneyFunnelModel }) {
  const maxCount = Math.max(...model.stages.map((s) => s.count), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer Journey</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anonymous → lead → registered → trial → paid → cancelled → recovered
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visual funnel (30 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {model.stages.map((stage) => (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{stage.label}</span>
                <span className="text-muted-foreground">
                  {stage.count} · {stage.conversionRate}% conv.
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(4, (stage.count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {model.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No journey events yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {model.recentEvents.map((e, i) => (
                <li key={`${e.occurredAt}-${i}`} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                  <span className="capitalize">{e.stage.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{e.email ?? e.channel ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.occurredAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

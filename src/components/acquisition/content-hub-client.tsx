"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentHubModel } from "@/lib/acquisition/content-hub";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "outline"> = {
  published: "success",
  writing: "outline",
  review: "outline",
  brief: "secondary",
  planned: "secondary",
  archived: "secondary",
};

export function ContentHubClient({ model }: { model: ContentHubModel }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revuvia SEO strategy — keywords, clusters, pillars, ROI estimates.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Keywords", model.summary.totalKeywords],
          ["Pillars", model.summary.pillars],
          ["Supporting", model.summary.supporting],
          ["Published", model.summary.published],
          ["Exp. leads", model.summary.expectedLeads],
          ["Exp. MRR", `$${Math.round(model.summary.expectedMrrUsd)}`],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Keyword pipeline</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {model.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keywords yet. Run SEO Intelligence or import a strategy.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Keyword</th>
                  <th className="py-2 pr-4">Cluster</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Intent</th>
                  <th className="py-2 pr-4">Vol.</th>
                  <th className="py-2 pr-4">Diff.</th>
                  <th className="py-2 pr-4">Leads</th>
                  <th className="py-2">MRR</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium">{row.keyword}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.cluster_name ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {row.page_role}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={STATUS_VARIANT[row.content_status] ?? "secondary"} className="text-[10px] capitalize">
                        {row.content_status}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 capitalize text-muted-foreground">{row.intent ?? "—"}</td>
                    <td className="py-2.5 pr-4">{row.volume}</td>
                    <td className="py-2.5 pr-4">{row.difficulty}</td>
                    <td className="py-2.5 pr-4">{row.expected_leads}</td>
                    <td className="py-2.5">${Math.round(row.expected_mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

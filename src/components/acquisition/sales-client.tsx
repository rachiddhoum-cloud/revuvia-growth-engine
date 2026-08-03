"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SalesPriorityRow } from "@/lib/acquisition/types";

export function SalesClient({ rows }: { rows: SalesPriorityRow[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prioritized prospects — MRR potential, ICE, close probability, outreach channel.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active prospects. Import leads or run outreach.</p>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Prospect</th>
                  <th className="py-2 pr-4">Stage</th>
                  <th className="py-2 pr-4">MRR pot.</th>
                  <th className="py-2 pr-4">ICE</th>
                  <th className="py-2 pr-4">Close %</th>
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2">Message preview</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email ?? row.company ?? "—"}</p>
                    </td>
                    <td className="py-2.5 pr-4 capitalize">{row.stage}</td>
                    <td className="py-2.5 pr-4">${row.potentialMrrUsd}</td>
                    <td className="py-2.5 pr-4">{row.iceScore}</td>
                    <td className="py-2.5 pr-4">{row.closeProbability}%</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {row.recommendedChannel}
                      </Badge>
                    </td>
                    <td className="py-2.5 max-w-xs truncate text-muted-foreground">{row.messagePreview}…</td>
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

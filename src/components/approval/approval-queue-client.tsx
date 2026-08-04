"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, X, FileText, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QUALITY_PASS_THRESHOLD } from "@/lib/quality";

export interface PendingApprovalItem {
  contentId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  qualityScore: number | null;
  status: string;
  waitingSince: string;
}

export function ApprovalQueueClient({
  initialItems,
  ownerId,
}: {
  initialItems: PendingApprovalItem[];
  ownerId: string;
}) {
  const [items, setItems] = React.useState(initialItems);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/pipeline/pending?ownerId=${encodeURIComponent(ownerId)}`);
    if (res.ok) {
      const data = (await res.json()) as { items: PendingApprovalItem[] };
      setItems(data.items);
    }
  }

  async function approve(contentId: string) {
    setBusyId(contentId);
    try {
      const res = await fetch("/api/pipeline/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, ownerId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Approbation échouée.");
        return;
      }
      toast.success("Contenu approuvé et publié dans le pipeline.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(contentId: string) {
    if (!window.confirm("Rejeter ce contenu et le renvoyer en brouillon ?")) return;
    setBusyId(contentId);
    try {
      const res = await fetch("/api/pipeline/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, ownerId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Rejet échoué.");
        return;
      }
      toast.success("Contenu renvoyé en brouillon.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approbations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contenus en attente de validation humaine avant publication automatique.
        </p>
      </div>

      {items.length === 0 ? (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Aucune approbation en attente</AlertTitle>
          <AlertDescription>
            Lancez un pipeline depuis la Content Factory avec le gate qualité activé. Les articles score ≥ 80
            s’arrêtent ici jusqu’à votre validation.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const busy = busyId === item.contentId;
            return (
              <Card key={item.contentId}>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {item.excerpt ?? `/${item.slug}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.qualityScore != null && (
                      <Badge variant={item.qualityScore >= QUALITY_PASS_THRESHOLD ? "success" : "secondary"}>
                        Score {item.qualityScore}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      En attente depuis {new Date(item.waitingSince).toLocaleString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button onClick={() => approve(item.contentId)} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Approuver & publier
                  </Button>
                  <Button variant="outline" onClick={() => reject(item.contentId)} disabled={busy}>
                    <X className="size-4" />
                    Rejeter
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

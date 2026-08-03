"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Unplug,
  AlertTriangle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface GscSettingsModel {
  configured: boolean;
  connected: boolean;
  ownerId: string;
  siteUrl: string | null;
  sites: Array<{ siteUrl: string; name: string | null }>;
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
  latestSync: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    rowsSynced: number | null;
    error: string | null;
  } | null;
  queryCount: number;
  pageCount: number;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function GscSettingsClient({ initial }: { initial: GscSettingsModel }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState(initial);
  const [syncing, setSyncing] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  const gscFlash = searchParams.get("gsc");
  const gscReason = searchParams.get("reason");

  React.useEffect(() => {
    if (gscFlash === "connected") {
      toast.success("Google Search Console connecté.");
    } else if (gscFlash === "error") {
      toast.error(`Connexion GSC échouée${gscReason ? `: ${gscReason}` : ""}.`);
    }
  }, [gscFlash, gscReason]);

  async function refreshStatus() {
    const res = await fetch(`/api/gsc/status?ownerId=${encodeURIComponent(status.ownerId)}`);
    if (res.ok) {
      setStatus((await res.json()) as GscSettingsModel);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/gsc/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: status.ownerId }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Synchronisation échouée.");
        return;
      }
      toast.success(`Sync terminée (${data.status ?? "ok"}).`);
      await refreshStatus();
    } catch {
      toast.error("Synchronisation échouée.");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Déconnecter Google Search Console et supprimer les données GSC locales ?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gsc/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: status.ownerId }),
      });
      if (!res.ok) {
        toast.error("Déconnexion échouée.");
        return;
      }
      toast.success("GSC déconnecté.");
      await refreshStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  const connectHref = `/api/gsc/connect?ownerId=${encodeURIComponent(status.ownerId)}`;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Search className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">Google Search Console</CardTitle>
            <CardDescription className="mt-1">
              Connectez GSC pour alimenter le moteur avec des données réelles (requêtes, pages, CTR, positions).
            </CardDescription>
          </div>
        </div>
        <Badge variant={status.connected ? "success" : status.configured ? "secondary" : "destructive"}>
          {status.connected ? "Connecté" : status.configured ? "Non connecté" : "Non configuré"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {gscFlash === "connected" && (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>Connexion réussie</AlertTitle>
            <AlertDescription>
              La synchronisation quotidienne démarre automatiquement à 09:00. Vous pouvez aussi lancer un sync manuel ci-dessous.
            </AlertDescription>
          </Alert>
        )}

        {!status.configured && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Configuration requise</AlertTitle>
            <AlertDescription>
              <p>Ajoutez ces variables dans Vercel ou <code className="text-xs">.env.local</code> :</p>
              <ul className="mt-2 list-inside list-disc text-xs">
                <li>GSC_CLIENT_ID</li>
                <li>GSC_CLIENT_SECRET</li>
                <li>GSC_REDIRECT_URI → {typeof window !== "undefined" ? `${window.location.origin}/api/gsc/callback` : "…/api/gsc/callback"}</li>
                <li>DEFAULT_OWNER_ID → UUID du profil Supabase</li>
              </ul>
              <p className="mt-2 text-xs">
                Créez un client OAuth dans{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Google Cloud Console
                </a>{" "}
                avec l’API Search Console activée.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Owner ID</p>
            <p className="mt-0.5 font-mono text-xs break-all">{status.ownerId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Site principal</p>
            <p className="mt-0.5">{status.siteUrl ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dernière sync</p>
            <p className="mt-0.5">{formatWhen(status.lastSyncedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Données indexées</p>
            <p className="mt-0.5">
              {status.queryCount.toLocaleString()} requêtes · {status.pageCount.toLocaleString()} pages
            </p>
          </div>
        </div>

        {status.latestSync && (
          <p className="text-xs text-muted-foreground">
            Dernier job : {status.latestSync.status}
            {status.latestSync.rowsSynced != null ? ` · ${status.latestSync.rowsSynced} lignes` : ""}
            {status.latestSync.error ? ` · ${status.latestSync.error}` : ""}
          </p>
        )}

        {status.sites.length > 1 && (
          <div className="text-xs text-muted-foreground">
            Sites vérifiés : {status.sites.map((s) => s.siteUrl).join(", ")}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status.configured && !status.connected && (
            <Button asChild>
              <Link href={connectHref}>
                <ExternalLink className="size-4" />
                Connecter Google Search Console
              </Link>
            </Button>
          )}
          {status.connected && (
            <>
              <Button onClick={syncNow} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Synchroniser maintenant
              </Button>
              <Button variant="outline" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                Déconnecter
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

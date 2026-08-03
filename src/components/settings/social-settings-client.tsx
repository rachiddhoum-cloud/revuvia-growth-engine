"use client";

import * as React from "react";
import { toast } from "sonner";
import { Linkedin, Facebook, X, Loader2, Unplug, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Platform = "linkedin" | "facebook" | "x";

const PLATFORM_META: Record<Platform, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    hint: "Page access token + account id (or urn:li:person:me for the personal wall).",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    hint: "Page access token + page id. Long-lived page token recommended.",
  },
  x: {
    label: "X (Twitter)",
    icon: X,
    hint: "User access token (OAuth 2.0) with tweet.write scope.",
  },
};

interface CredState {
  connected: boolean;
  accountName: string | null;
}

export function SocialSettingsClient({ ownerId, initial }: { ownerId: string; initial: Record<string, CredState> }) {
  const [platforms, setPlatforms] = React.useState(initial);
  const [token, setToken] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [editing, setEditing] = React.useState<Platform | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState<Platform | null>(null);

  async function refresh() {
    const res = await fetch(`/api/social/credentials?ownerId=${encodeURIComponent(ownerId)}`);
    if (res.ok) {
      const data = (await res.json()) as { platforms: Record<string, CredState> };
      setPlatforms(data.platforms);
    }
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/social/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          platform: editing,
          accessToken: token,
          accountId: accountId || undefined,
          accountName: accountName || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      toast.success("Plateforme connectée.");
      setToken("");
      setAccountId("");
      setAccountName("");
      setEditing(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(platform: Platform) {
    setRemoving(platform);
    try {
      const res = await fetch("/api/social/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, platform }),
      });
      if (!res.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      toast.success("Plateforme déconnectée.");
      await refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Social publishing</CardTitle>
          <CardDescription>
            Paste the platform tokens so the daily publishing cron posts real content
            (LinkedIn / Facebook / X) instead of only recording drafts.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
          const meta = PLATFORM_META[platform];
          const Icon = meta.icon;
          const state = platforms[platform] ?? { connected: false, accountName: null };
          const isEditing = editing === platform;
          return (
            <div key={platform} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {state.connected ? (
                        <Badge variant="success">Connected{state.accountName ? ` — ${state.accountName}` : ""}</Badge>
                      ) : (
                        <Badge variant="secondary">Not connected</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {state.connected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(platform)}
                      disabled={removing === platform}
                    >
                      {removing === platform ? <Loader2 className="size-3 animate-spin" /> : <Unplug className="size-3" />}
                      Disconnect
                    </Button>
                  )}
                  <Button size="sm" variant={isEditing ? "secondary" : "default"} onClick={() => setEditing(isEditing ? null : platform)}>
                    <Plus className="size-3" />
                    {isEditing ? "Cancel" : state.connected ? "Update" : "Connect"}
                  </Button>
                </div>
              </div>
              {isEditing && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <p className="text-xs text-muted-foreground">{meta.hint}</p>
                  <div className="space-y-1">
                    <Label htmlFor={`token-${platform}`}>Access token</Label>
                    <Input
                      id={`token-${platform}`}
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Paste the access token"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`account-${platform}`}>Account / page id (optional)</Label>
                      <Input
                        id={`account-${platform}`}
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        placeholder="page id or urn:li:person:me"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`name-${platform}`}>Account name (optional)</Label>
                      <Input
                        id={`name-${platform}`}
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="My page"
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={save} disabled={saving || token.trim().length < 10}>
                    {saving ? <Loader2 className="size-3 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

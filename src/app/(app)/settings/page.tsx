import { Suspense } from "react";
import { KeyRound, Globe, Database, Rocket } from "lucide-react";

import { GscSettingsClient } from "@/components/settings/gsc-settings-client";
import { SocialSettingsClient } from "@/components/settings/social-settings-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadGscConnectionStatus } from "@/lib/gsc/status";
import { resolveOwnerId } from "@/lib/owner";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = {
  title: "Settings",
};

export const dynamic = "force-dynamic";

const configItems = [
  {
    icon: KeyRound,
    title: "AI providers",
    description:
      "Gemini (free tier via AI Studio), OpenAI and Anthropic power content, SEO and lead magnets. Set GEMINI_API_KEY or GOOGLE_AI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, and optional AI_PROVIDER=gemini.",
  },
  {
    icon: Database,
    title: "Database",
    description:
      "Supabase stores projects, keywords, content, calendar entries and metrics. Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",
  },
  {
    icon: Globe,
    title: "App URL",
    description:
      "NEXT_PUBLIC_APP_URL is used for canonical URLs, OAuth redirects and absolute links in generated content.",
  },
  {
    icon: Rocket,
    title: "Email & crons",
    description:
      "Resend (RESEND_API_KEY) powers report emails. CRON_SECRET protects scheduled jobs on Vercel.",
  },
];

export default async function SettingsPage() {
  const ownerId = resolveOwnerId(null);
  const gscStatus = await loadGscConnectionStatus(ownerId);

  const sb = createServiceRoleClient();
  const { data: socialRows } = await sb
    .from("social_credentials")
    .select("platform,account_name")
    .eq("owner_id", ownerId);
  const socialInitial: Record<string, { connected: boolean; accountName: string | null }> = {};
  for (const row of socialRows ?? []) {
    socialInitial[row.platform] = { connected: true, accountName: row.account_name };
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Runtime configuration and integrations for the Growth Engine.
          </p>
        </div>
        <Badge variant="secondary">production-ready</Badge>
      </div>

      <Suspense fallback={null}>
        <GscSettingsClient initial={gscStatus} />
      </Suspense>

      <Suspense fallback={null}>
        <SocialSettingsClient ownerId={ownerId} initial={socialInitial} />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        {configItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader className="flex-row items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

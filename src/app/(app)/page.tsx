import { ArrowUpRight, FileText, Search, Magnet, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const MODULES = [
  {
    title: "SEO Intelligence",
    description: "Find keyword opportunities, clusters, intent and priority ranking.",
    href: "/seo",
    icon: Search,
    cta: "Analyze a keyword",
  },
  {
    title: "Content Factory",
    description: "Generate articles, landing pages, FAQs and social posts from one keyword.",
    href: "/content",
    icon: FileText,
    cta: "Generate content",
  },
  {
    title: "Lead Magnets",
    description: "Produce checklists, guides, ebooks and worksheets that capture emails.",
    href: "/lead-magnets",
    icon: Magnet,
    cta: "Create a magnet",
  },
  {
    title: "Content Calendar",
    description: "Auto-schedule a daily, weekly or monthly publishing plan.",
    href: "/calendar",
    icon: ArrowUpRight,
    cta: "Plan the month",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Growth Engine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI operating system that continuously generates traffic and customers for Revuvia.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Articles published", value: "0", trend: "Start with Content Factory", icon: FileText },
          { label: "Keywords tracked", value: "0", trend: "Run SEO Intelligence", icon: Search },
          { label: "Lead downloads", value: "0", trend: "Create a lead magnet", icon: Magnet },
          { label: "Organic traffic", value: "0", trend: "30-day window", icon: Users },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardDescription className="text-xs font-medium">{stat.label}</CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.trend}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="transition-colors hover:border-primary/40">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{module.title}</CardTitle>
                    <CardDescription className="mt-1">{module.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge variant="secondary">{module.cta}</Badge>
                <Button asChild variant="ghost" size="sm">
                  <Link href={module.href}>
                    Open <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

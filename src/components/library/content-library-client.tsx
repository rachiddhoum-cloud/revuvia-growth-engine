"use client";

import * as React from "react";
import { Search, FileText, Magnet, FileQuestion, LayoutTemplate, History, Tag } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ContentKind } from "@/types";

interface LibraryItem {
  id: string;
  title: string;
  kind: ContentKind;
  status: string;
  tags: string[];
  updatedAt: string;
  version: number;
  excerpt?: string;
}

const KIND_ICON: Record<ContentKind, React.ElementType> = {
  article: FileText,
  landing: LayoutTemplate,
  faq: FileQuestion,
  lead_magnet: Magnet,
};

export function ContentLibraryClient({ items = [] }: { items?: LibraryItem[] }) {
  const [query, setQuery] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<ContentKind | "all">("all");

  const filtered = items.filter((item) => {
    const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());
    const matchesKind = kindFilter === "all" || item.kind === kindFilter;
    return matchesQuery && matchesKind;
  });

  const allTags = Array.from(new Set(items.flatMap((i) => i.tags)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every generated asset — articles, landing pages, FAQs and lead magnets — searchable and
          versioned.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search content…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "article", "landing", "faq", "lead_magnet"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                kindFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {k === "lead_magnet" ? "Lead magnet" : k}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="size-3.5 text-muted-foreground" />
          {allTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No content yet. Generate your first asset in the Content Factory or Lead Magnet Generator."
                : "No content matches your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <Card key={item.id} className="gap-3">
                <CardHeader className="flex-row items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      {item.excerpt && (
                        <CardDescription className="mt-1 line-clamp-2">{item.excerpt}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant={item.status === "published" ? "success" : "secondary"} className="shrink-0 text-[10px]">
                    {item.status}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <History className="size-3" /> v{item.version}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[9px]">
                      {tag}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

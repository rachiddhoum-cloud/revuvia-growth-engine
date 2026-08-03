"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2, Plus, ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalendarPlan, CalendarChannel, ContentStatus } from "@/types";

const STATUS_STYLES: Record<ContentStatus, { label: string; cls: string }> = {
  idea: { label: "Idea", cls: "bg-muted text-muted-foreground" },
  keyword_research: { label: "Keyword research", cls: "bg-muted text-muted-foreground" },
  seo_brief: { label: "SEO brief", cls: "bg-muted text-muted-foreground" },
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  writing: { label: "Writing", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  quality: { label: "Quality", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ready: { label: "Ready", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  approved: { label: "Approved", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  queued: { label: "Queued", cls: "bg-muted text-muted-foreground" },
  published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

const CHANNEL_COLORS: Record<CalendarChannel, string> = {
  blog: "bg-primary/15 text-primary",
  linkedin: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  facebook: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  instagram: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  x: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  email: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

interface EditableItem {
  id: string;
  title: string;
  scheduledAt: string;
  channel: CalendarChannel;
  status: ContentStatus;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function CalendarClient() {
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = React.useState<"daily" | "weekly" | "monthly">("weekly");
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<EditableItem[]>([]);
  const [cursor, setCursor] = React.useState<Date>(() => new Date());

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, frequency }),
      });
      if (!res.ok) throw new Error("Plan generation failed");
      const data = (await res.json()) as { plan: CalendarPlan };
      setItems(data.plan.items.map((item) => ({ ...item, id: crypto.randomUUID() })));
      setCursor(new Date(data.plan.startDate));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan generation failed");
    } finally {
      setLoading(false);
    }
  }

  function shift(days: number) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + days);
    setCursor(next);
  }

  function updateStatus(id: string, status: ContentStatus) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  const daysInView: EditableItem[] = items.filter((i) => {
    const d = new Date(i.scheduledAt);
    return (
      d.getFullYear() === cursor.getFullYear() &&
      d.getMonth() === cursor.getMonth() &&
      d.getDate() === cursor.getDate()
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a daily, weekly or monthly publishing plan. Edit titles and advance statuses as
          work progresses.
        </p>
      </div>

      <form onSubmit={generate} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end">
        <div>
          <Label htmlFor="cal-start">Start date</Label>
          <Input
            id="cal-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="cal-freq">Frequency</Label>
          <select
            id="cal-freq"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            className="mt-1.5 h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {loading ? "Planning…" : "Generate plan"}
        </Button>
      </form>

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
                <ArrowLeft className="size-4" />
              </Button>
              <h2 className="min-w-40 text-center text-sm font-semibold">
                <CalendarDays className="mr-1.5 inline size-4 text-primary" />
                {monthLabel(cursor)}
              </h2>
              <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
                <ArrowRight className="size-4" />
              </Button>
            </div>
            <Badge variant="secondary">{items.length} scheduled</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {daysInView.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing scheduled for this day.
                </p>
              )}
              {daysInView.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${CHANNEL_COLORS[item.channel]}`}>
                        {item.channel}
                      </span>
                      <p className="truncate text-sm font-medium">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(
                        ["idea", "writing", "review", "ready", "published"] as ContentStatus[]
                      ).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(item.id, s)}
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold transition-colors ${
                            item.status === s
                              ? STATUS_STYLES[s].cls + " ring-1 ring-ring"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                          aria-pressed={item.status === s}
                        >
                          {s === "published" && item.status === "published" ? <Check className="mr-1 inline size-3" /> : null}
                          {STATUS_STYLES[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

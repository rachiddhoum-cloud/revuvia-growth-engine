import { describe, expect, it } from "vitest";

import {
  addDays,
  draftForPlatform,
  dueSlots,
  markPublished,
  publishableArticles,
  schedulePublishing,
} from "@/lib/ops/publishing";

const articles = [
  { id: "a1", title: "SEO pour restaurants à Marrakech", slug: "seo-restaurants", excerpt: "Guide complet." },
  { id: "a2", title: "Avis Google et QR codes", slug: "avis-google", excerpt: "Comment automatiser." },
  { id: "a3", title: "Réserver plus de clients", slug: "reserver-clients", excerpt: "Pratique." },
];

describe("schedulePublishing", () => {
  it("schedules blog slots capped by blogPerWeek, rolling extras to next week", () => {
    const { plan, blogNextWeek } = schedulePublishing(articles, {
      startDate: "2026-08-03",
      days: 7,
      blogPerWeek: 2,
    });
    const blog = plan.slots.filter((s) => s.platform === "blog");
    expect(blog.map((s) => s.scheduledFor)).toEqual(["2026-08-03", "2026-08-04", "2026-08-10"]);
    expect(blogNextWeek.map((a) => a.id)).toEqual(["a3"]);
  });

  it("creates one slot per article per platform", () => {
    const { plan } = schedulePublishing(articles, { startDate: "2026-08-03" });
    expect(plan.slots.length).toBe(articles.length * 4);
    const platforms = new Set(plan.slots.map((s) => s.platform));
    expect(platforms).toEqual(new Set(["blog", "linkedin", "facebook", "x"]));
  });

  it("staggeres social slots one day after each other", () => {
    const { plan } = schedulePublishing([articles[0]], { startDate: "2026-08-03" });
    const social = plan.slots.filter((s) => s.platform !== "blog");
    expect(social.map((s) => s.scheduledFor)).toEqual(["2026-08-04", "2026-08-05", "2026-08-06"]);
  });

  it("sorts slots by date then content then platform", () => {
    const { plan } = schedulePublishing(articles, { startDate: "2026-08-03", days: 3, blogPerWeek: 3 });
    const dates = plan.slots.map((s) => s.scheduledFor);
    expect([...dates].sort()).toEqual(dates);
  });

  it("every slot is deterministic", () => {
    const a = schedulePublishing(articles, { startDate: "2026-08-03" });
    const b = schedulePublishing(articles, { startDate: "2026-08-03" });
    expect(a.plan.slots).toEqual(b.plan.slots);
  });
});

describe("draftForPlatform", () => {
  it("blog draft contains title and URL", () => {
    const draft = draftForPlatform(articles[0], "blog");
    expect(draft).toContain("SEO pour restaurants");
    expect(draft).toContain("revuvia.com/blog/seo-restaurants");
  });

  it("x draft is a single short line", () => {
    const draft = draftForPlatform(articles[0], "x");
    expect(draft.length).toBeLessThan(280);
    expect(draft).toContain("revuvia.com/blog/seo-restaurants");
  });

  it("linkedin draft has a CTA question", () => {
    const draft = draftForPlatform(articles[0], "linkedin");
    expect(draft).toContain("move the needle");
  });
});

describe("dueSlots / markPublished", () => {
  const { plan } = schedulePublishing([articles[0]], { startDate: "2026-08-03" });

  it("returns only scheduled slots before or on today", () => {
    const due = dueSlots(plan, "2026-08-04");
    expect(due.map((s) => s.platform)).toEqual(["blog", "linkedin"]);
  });

  it("marks due slots published, keeps future ones scheduled", () => {
    const updated = markPublished(plan, "2026-08-04");
    const blog = updated.slots.find((s) => s.platform === "blog");
    const x = updated.slots.find((s) => s.platform === "x");
    expect(blog?.status).toBe("published");
    expect(x?.status).toBe("scheduled");
  });

  it("is idempotent when called twice", () => {
    const once = markPublished(plan, "2026-08-04");
    const twice = markPublished(once, "2026-08-04");
    expect(twice).toEqual(once);
  });
});

describe("publishableArticles", () => {
  it("keeps only approved or queued articles", () => {
    const rows = [
      { id: "1", title: "A", status: "approved" },
      { id: "2", title: "B", status: "queued" },
      { id: "3", title: "C", status: "published" },
      { id: "4", title: "D", status: "idea" },
    ];
    const kept = publishableArticles(rows);
    expect(kept.map((a) => a.id)).toEqual(["1", "2"]);
  });
});

describe("addDays", () => {
  it("handles month boundaries without UTC shift", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

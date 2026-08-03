import { describe, expect, it } from "vitest";

import {
  buildOutreachEmailDraft,
  buildOutreachQueue,
  matchProspect,
  titleFromUrl,
} from "@/lib/ops/outreach";
import type { PageStat } from "@/lib/gsc/linking-intel";

const pages: PageStat[] = [
  { url: "https://revuvia.app/blog/pricing-guide", title: "Pricing guide for SaaS", clicks: 120, impressions: 4200, incomingLinks: 0 },
  { url: "https://revuvia.app/blog/lead-magnets", title: "Lead magnet ideas", clicks: 40, impressions: 1800, incomingLinks: 0 },
  { url: "https://revuvia.app/blog/linked-page", title: "Linked page", clicks: 300, impressions: 9000, incomingLinks: 2 },
  { url: "https://revuvia.app/blog/backlinked-page", title: "Backlinked page", clicks: 90, impressions: 3000, incomingLinks: 0 },
  { url: "https://revuvia.app/blog/no-traffic", title: "No traffic yet", clicks: 0, impressions: 60, incomingLinks: 0 },
];

const externalLinks = new Map<string, { count: number; maxDomainRating: number }>([
  ["https://revuvia.app/blog/backlinked-page", { count: 4, maxDomainRating: 42 }],
]);

const prospects = [
  { company: "SaaS Growth Academy", industry: "SaaS", contactName: "Dana" },
  { company: "Bakery Supply Co", industry: "Food" },
];

describe("titleFromUrl", () => {
  it("extracts a readable title from the URL path", () => {
    expect(titleFromUrl("https://revuvia.app/blog/lead-magnets")).toBe("lead magnets");
  });

  it("handles encoding, extensions and empty paths", () => {
    expect(titleFromUrl("https://revuvia.app/guide%20to%20seo")).toBe("guide to seo");
    expect(titleFromUrl("https://revuvia.app/report.pdf")).toBe("report");
    expect(titleFromUrl("https://revuvia.app")).toBe("");
    expect(titleFromUrl("not a url")).toBe("");
  });
});

describe("matchProspect", () => {
  it("picks the prospect sharing the most tokens with the title", () => {
    const matched = matchProspect(prospects, "Pricing guide for SaaS products");
    expect(matched?.company).toBe("SaaS Growth Academy");
  });

  it("returns null when no prospect shares a token", () => {
    expect(matchProspect(prospects, "Vegan cookie recipes")).toBeNull();
    expect(matchProspect([], "Anything here")).toBeNull();
  });
});

describe("buildOutreachEmailDraft", () => {
  it("renders a complete draft with anchor, url and sender", () => {
    const draft = buildOutreachEmailDraft({
      pageTitle: "Pricing guide for SaaS",
      pageUrl: "https://revuvia.app/blog/pricing-guide",
      impressions: 4200,
      anchor: "pricing guide for saas",
      companyName: "Revuvia",
      domain: "revuvia.app",
    });
    expect(draft).toContain("Revuvia");
    expect(draft).toContain("(revuvia.app)");
    expect(draft).toContain("4200 impressions");
    expect(draft).toContain('"pricing guide for saas"');
    expect(draft).toContain("https://revuvia.app/blog/pricing-guide");
  });

  it("personalizes when a prospect matches", () => {
    const draft = buildOutreachEmailDraft({
      pageTitle: "Pricing guide for SaaS",
      pageUrl: "https://revuvia.app/blog/pricing-guide",
      impressions: 100,
      anchor: "pricing",
      prospect: prospects[0],
    });
    expect(draft).toContain("Hi Dana");
    expect(draft).toContain("SaaS Growth Academy");
  });
});

describe("buildOutreachQueue", () => {
  it("returns an empty queue when no page qualifies", () => {
    const linked = pages.filter((p) => p.incomingLinks > 0);
    expect(buildOutreachQueue({ pages: linked }).tasks).toHaveLength(0);
    expect(buildOutreachQueue({ pages: [] }).tasks).toHaveLength(0);
  });

  it("excludes pages that have internal links or backlinks", () => {
    const plan = buildOutreachQueue({ pages, externalLinks });
    const urls = plan.tasks.map((t) => t.pageUrl);
    expect(urls).not.toContain("https://revuvia.app/blog/linked-page");
    expect(urls).not.toContain("https://revuvia.app/blog/backlinked-page");
    expect(urls).toContain("https://revuvia.app/blog/pricing-guide");
    expect(urls).toContain("https://revuvia.app/blog/no-traffic");
  });

  it("ranks by ice then clicks", () => {
    const plan = buildOutreachQueue({ pages, externalLinks });
    expect(plan.tasks[0].pageUrl).toBe("https://revuvia.app/blog/pricing-guide");
    expect(plan.tasks[1].pageUrl).toBe("https://revuvia.app/blog/lead-magnets");
    expect(plan.tasks[2].pageUrl).toBe("https://revuvia.app/blog/no-traffic");
    expect(plan.tasks[0].priority).toBeDefined();
  });

  it("respects the limit", () => {
    expect(buildOutreachQueue({ pages, externalLinks, limit: 2 }).tasks).toHaveLength(2);
  });

  it("fills title and anchor from the URL when the title is missing", () => {
    const plan = buildOutreachQueue({
      pages: [{ url: "https://revuvia.app/blog/zero-link-page", title: "", clicks: 5, impressions: 200, incomingLinks: 0 }],
    });
    expect(plan.tasks[0].pageTitle).toBe("zero link page");
    expect(plan.tasks[0].anchor).toBe("zero link page");
  });

  it("attaches the matched prospect to the task", () => {
    const plan = buildOutreachQueue({ pages, externalLinks, prospects });
    const task = plan.tasks.find((t) => t.pageUrl.includes("pricing-guide"));
    expect(task?.prospectCompany).toBe("SaaS Growth Academy");
    expect(task?.emailDraft).toContain("SaaS Growth Academy");
  });

  it("is deterministic for the same input", () => {
    const a = buildOutreachQueue({ pages, externalLinks, prospects });
    const b = buildOutreachQueue({ pages, externalLinks, prospects });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

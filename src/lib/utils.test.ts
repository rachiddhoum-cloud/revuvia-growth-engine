import { describe, expect, it } from "vitest";

import { slugify, formatNumber, clamp } from "@/lib/utils";

describe("slugify", () => {
  it("strips accents and lowercases", () => {
    expect(slugify("Comment Obtenir Plus d'Avis")).toBe("comment-obtenir-plus-d-avis");
  });

  it("collapses separators and trims edges", () => {
    expect(slugify("  QR code — 5 astuces!  ")).toBe("qr-code-5-astuces");
  });

  it("caps length at 120 chars", () => {
    expect(slugify("x".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});

describe("formatNumber", () => {
  it("uses compact notation", () => {
    expect(formatNumber(12500)).toBe("12.5K");
  });
});

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

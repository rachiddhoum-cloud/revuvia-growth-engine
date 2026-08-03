import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { FALLBACK_OWNER_ID, resolveOwnerId } from "@/lib/owner";

describe("resolveOwnerId", () => {
  const original = process.env.DEFAULT_OWNER_ID;

  beforeEach(() => {
    delete process.env.DEFAULT_OWNER_ID;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DEFAULT_OWNER_ID;
    else process.env.DEFAULT_OWNER_ID = original;
  });

  it("returns env UUID when set", () => {
    process.env.DEFAULT_OWNER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(resolveOwnerId(null)).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  it("maps legacy system alias to env/default", () => {
    process.env.DEFAULT_OWNER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(resolveOwnerId("system")).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  it("falls back when env is missing", () => {
    expect(resolveOwnerId("system")).toBe(FALLBACK_OWNER_ID);
  });

  it("accepts explicit UUID", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    expect(resolveOwnerId(id)).toBe(id);
  });
});

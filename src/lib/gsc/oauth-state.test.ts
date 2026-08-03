import { describe, expect, it } from "vitest";

import { buildOAuthState, verifyOAuthState } from "@/lib/gsc/oauth-state";

const SECRET = "test-secret";

describe("buildOAuthState / verifyOAuthState", () => {
  it("round-trips a valid state", () => {
    const now = Date.now();
    const state = buildOAuthState("owner-1", SECRET, now);
    const result = verifyOAuthState(state, SECRET, now + 1000);
    expect(result.ok).toBe(true);
    expect(result.ownerId).toBe("owner-1");
    expect(result.reason).toBe("valid");
  });

  it("rejects a tampered payload", () => {
    const now = Date.now();
    const state = buildOAuthState("owner-1", SECRET, now);
    const tampered = `AAA.${state.split(".")[1]}`;
    expect(verifyOAuthState(tampered, SECRET, now).reason).toBe("tampered");
  });

  it("rejects a state signed with a different secret", () => {
    const state = buildOAuthState("owner-1", "other-secret");
    expect(verifyOAuthState(state, SECRET).reason).toBe("tampered");
  });

  it("rejects an expired state", () => {
    const now = Date.now();
    const state = buildOAuthState("owner-1", SECRET, now, 1000);
    expect(verifyOAuthState(state, SECRET, now + 2000).reason).toBe("expired");
  });

  it("rejects missing state", () => {
    expect(verifyOAuthState(null, SECRET).reason).toBe("missing");
    expect(verifyOAuthState("", SECRET).reason).toBe("missing");
  });

  it("rejects malformed state", () => {
    expect(verifyOAuthState("not-a-valid-state", SECRET).reason).toBe("tampered");
  });
});

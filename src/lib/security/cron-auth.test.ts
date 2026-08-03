import { describe, expect, it } from "vitest";

import { isCronAuthorized } from "@/lib/security/cron-auth";

describe("isCronAuthorized", () => {
  it("rejects when CRON_SECRET is unset", () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const request = new Request("http://localhost/api/jobs/run", {
      headers: { authorization: "Bearer anything" },
    });

    expect(isCronAuthorized(request)).toBe(false);
    process.env.CRON_SECRET = prev;
  });

  it("accepts Authorization Bearer header", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";

    const request = new Request("http://localhost/api/jobs/run", {
      headers: { authorization: "Bearer test-cron-secret-32chars-min" },
    });

    expect(isCronAuthorized(request)).toBe(true);
  });

  it("accepts x-cron-secret header", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";

    const request = new Request("http://localhost/api/jobs/run", {
      headers: { "x-cron-secret": "test-cron-secret-32chars-min" },
    });

    expect(isCronAuthorized(request)).toBe(true);
  });

  it("rejects empty header when secret unset (fail-closed)", () => {
    delete process.env.CRON_SECRET;

    const request = new Request("http://localhost/api/jobs/run", {
      headers: { "x-cron-secret": "" },
    });

    expect(isCronAuthorized(request)).toBe(false);
  });
});

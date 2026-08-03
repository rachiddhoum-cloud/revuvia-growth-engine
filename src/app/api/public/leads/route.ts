import { NextResponse } from "next/server";

import { ApiError } from "@/lib/http/api-error";
import { withRouteHandler } from "@/lib/http";
import { MemoryRateLimiter } from "@/lib/reliability/rate-limit";
import { captureLead, isValidLeadEmail } from "@/lib/acquisition/lead-capture";

const leadLimiter = new MemoryRateLimiter(10, 60_000);

interface LeadBody {
  email?: unknown;
  fullName?: unknown;
  company?: unknown;
  phone?: unknown;
  source?: unknown;
  contentItemId?: unknown;
  ctaId?: unknown;
  keywordId?: unknown;
  visitorId?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  referrer?: unknown;
}

/** Public lead capture from Revuvia content CTAs. */
export const POST = withRouteHandler<LeadBody>(
  async (body, ctx) => {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!isValidLeadEmail(email)) {
      throw ApiError.badRequest("Valid email required");
    }

    const result = await captureLead({
      email,
      fullName: typeof body.fullName === "string" ? body.fullName : undefined,
      company: typeof body.company === "string" ? body.company : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      source: typeof body.source === "string" ? body.source : "content",
      contentItemId: typeof body.contentItemId === "string" ? body.contentItemId : undefined,
      ctaId: typeof body.ctaId === "string" ? body.ctaId : undefined,
      keywordId: typeof body.keywordId === "string" ? body.keywordId : undefined,
      visitorId: typeof body.visitorId === "string" ? body.visitorId : ctx.ip,
      utmSource: typeof body.utmSource === "string" ? body.utmSource : undefined,
      utmMedium: typeof body.utmMedium === "string" ? body.utmMedium : undefined,
      utmCampaign: typeof body.utmCampaign === "string" ? body.utmCampaign : undefined,
      referrer: typeof body.referrer === "string" ? body.referrer : undefined,
    });

    return NextResponse.json({ ok: true, leadId: result.id });
  },
  { rateLimit: { limiter: leadLimiter, keyPrefix: "public-lead" } }
);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

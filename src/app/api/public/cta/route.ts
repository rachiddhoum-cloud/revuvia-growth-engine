import { NextResponse } from "next/server";

import { ApiError } from "@/lib/http/api-error";
import { withRouteHandler } from "@/lib/http";
import { MemoryRateLimiter } from "@/lib/reliability/rate-limit";
import { loadContentCtas, trackCtaEvent } from "@/lib/acquisition/lead-capture";

const ctaLimiter = new MemoryRateLimiter(60, 60_000);

interface CtaBody {
  ctaId?: unknown;
  contentItemId?: unknown;
  eventType?: unknown;
  visitorId?: unknown;
  email?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
}

/** GET ?contentItemId= — list active CTAs for embed. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const contentItemId = url.searchParams.get("contentItemId")?.trim();
  if (!contentItemId) {
    return NextResponse.json({ error: "contentItemId required" }, { status: 400 });
  }

  try {
    const ctas = await loadContentCtas(contentItemId);
    return NextResponse.json(
      { ctas },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load CTAs" }, { status: 500 });
  }
}

/** POST — track impression / click / conversion. */
export const POST = withRouteHandler<CtaBody>(
  async (body, ctx) => {
    const eventType = body.eventType;
    if (eventType !== "impression" && eventType !== "click" && eventType !== "conversion") {
      throw ApiError.badRequest("eventType must be impression, click or conversion");
    }

    await trackCtaEvent({
      ctaId: typeof body.ctaId === "string" ? body.ctaId : undefined,
      contentItemId: typeof body.contentItemId === "string" ? body.contentItemId : undefined,
      eventType,
      visitorId: typeof body.visitorId === "string" ? body.visitorId : ctx.ip,
      email: typeof body.email === "string" ? body.email : undefined,
      referrer: typeof body.referrer === "string" ? body.referrer : undefined,
      utmSource: typeof body.utmSource === "string" ? body.utmSource : undefined,
      utmMedium: typeof body.utmMedium === "string" ? body.utmMedium : undefined,
      utmCampaign: typeof body.utmCampaign === "string" ? body.utmCampaign : undefined,
    });

    return NextResponse.json({ ok: true });
  },
  { rateLimit: { limiter: ctaLimiter, keyPrefix: "public-cta" } }
);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

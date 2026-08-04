import { NextResponse } from "next/server";

import { loadPublicBlogArticleBySlug } from "@/lib/publishing/public-blog";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** GET — single published article by slug. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const trimmed = slug?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    const article = await loadPublicBlogArticleBySlug(trimmed);
    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json({ article }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ error: "Failed to load article" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

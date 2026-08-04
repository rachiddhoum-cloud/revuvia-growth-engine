import { NextResponse } from "next/server";

import { loadPublicBlogArticles } from "@/lib/publishing/public-blog";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** GET — list published blog articles for revuvia.com (ISR / embed). */
export async function GET() {
  try {
    const articles = await loadPublicBlogArticles();
    return NextResponse.json(
      {
        site: process.env.REVUVIA_SITE_URL?.trim() || "https://revuvia.com",
        count: articles.length,
        articles,
      },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load blog articles" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isApiAuthorizedEdge, isOpsSessionAuthorizedEdge } from "@/lib/security/edge-auth";

const PUBLIC_API_PREFIXES = ["/api/public/"];

const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/gsc/callback",
  "/api/ops/login",
  "/api/public/leads",
  "/api/public/cta",
  "/api/public/blog",
  "/api/public/gsc-connect",
]);

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicPage(pathname: string): boolean {
  return pathname === "/blog" || pathname.startsWith("/blog/") || pathname === "/connect-gsc";
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    if (!isApiAuthorizedEdge(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (!isOpsSessionAuthorizedEdge(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

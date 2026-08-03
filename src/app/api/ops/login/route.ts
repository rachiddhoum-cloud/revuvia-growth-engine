import { NextResponse } from "next/server";

import { OPS_SESSION_COOKIE } from "@/lib/security/ops-session-constants";
import { readOpsSessionToken, verifyOpsAccessPassword } from "@/lib/security/ops-session";

export const runtime = "nodejs";

interface LoginBody {
  password?: unknown;
}

/** POST /api/ops/login — sets ops session cookie after password check. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: LoginBody = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  if (!verifyOpsAccessPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const sessionToken = readOpsSessionToken();
  if (!sessionToken) {
    return NextResponse.json(
      { error: "OPS_ACCESS_PASSWORD or OPS_SESSION_TOKEN is not configured" },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPS_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

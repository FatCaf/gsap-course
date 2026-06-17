import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/zoom";

// GET /zoom/callback?code=... -> exchange code, store tokens in httpOnly
// cookies (POC store; use a DB per-user in production), redirect to dashboard.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const token = await exchangeCode(code);

  const res = NextResponse.redirect(new URL("/", req.url));
  const secure = req.nextUrl.protocol === "https:";
  res.cookies.set("zoom_access_token", token.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: token.expires_in,
    path: "/",
  });
  res.cookies.set("zoom_refresh_token", token.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// GET /api/stream-token?userId=... -> { token }
// Stream user tokens are plain HS256 JWTs signed with the API secret, so we sign
// them with `jsonwebtoken` instead of pulling in @stream-io/node-sdk.
// Replace the userId lookup with real auth (e.g. getServerSession) in prod.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const secret = process.env.STREAM_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STREAM_API_SECRET unset" }, { status: 500 });
  }

  // iat is added automatically; exp keeps tokens short-lived. The SDK's
  // tokenProvider re-fetches on expiry.
  const token = jwt.sign({ user_id: userId }, secret, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  return NextResponse.json({ token });
}
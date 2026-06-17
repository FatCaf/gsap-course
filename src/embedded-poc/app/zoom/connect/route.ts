import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/zoom";

// GET /zoom/connect -> redirect user to Zoom OAuth consent.
export async function GET() {
  return NextResponse.redirect(authorizeUrl());
}
import { NextRequest, NextResponse } from "next/server";
import {
  createMeeting,
  listMeetings,
  deleteMeeting,
  derivePasscode,
  updateMeetingPassword,
} from "@/lib/zoom";
import { getZoomAccessToken } from "@/lib/zoom-session";

// POST /api/meetings  (body: topic=...) -> create a Zoom meeting for the
// connected host. Returns { join_link, zoom_meeting_id } or zoom_not_connected.
export async function POST(req: NextRequest) {
  const token = await getZoomAccessToken();
  if (!token) {
    return NextResponse.json({ error: "zoom_not_connected" });
  }

  const form = await req.formData();
  const topic = (form.get("topic") as string) || "Meeting";

  try {
    const meeting = await createMeeting(token, topic);
    // Overwrite passcode with a deterministic one derived from the id, so
    // participants can join with only the id (no server-side store needed).
    await updateMeetingPassword(token, meeting.id, derivePasscode(meeting.id));

    return NextResponse.json({
      zoom_meeting_id: String(meeting.id),
      join_link: `/meeting/${meeting.id}`,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("createMeeting failed:", detail);
    return NextResponse.json(
      { error: "create_failed", detail },
      { status: 502 },
    );
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Created meetings can show under different list buckets — gather + dedupe.
// Serial (not Promise.all) to stay under Zoom's per-second rate limit.
async function gatherMeetings(token: string) {
  const types = ["scheduled", "upcoming_meetings", "previous_meetings"] as const;
  const byId = new Map<number, { id: number; topic: string }>();
  for (const t of types) {
    const list = await listMeetings(token, t);
    for (const m of list) byId.set(m.id, m);
  }
  return [...byId.values()];
}

// GET /api/meetings -> list current user's meetings (all buckets).
export async function GET() {
  const token = await getZoomAccessToken();
  if (!token) return NextResponse.json({ error: "zoom_not_connected" });

  const meetings = await gatherMeetings(token);
  return NextResponse.json({ count: meetings.length, meetings });
}

// DELETE /api/meetings -> delete ALL the user's meetings, with per-item reasons.
export async function DELETE() {
  const token = await getZoomAccessToken();
  if (!token) return NextResponse.json({ error: "zoom_not_connected" });

  const meetings = await gatherMeetings(token);

  // Delete serially with a small gap — avoids 429 burst limit.
  const errors: { id: number; reason: string }[] = [];
  let deleted = 0;
  for (const m of meetings) {
    try {
      await deleteMeeting(token, m.id);
      deleted++;
    } catch (e) {
      errors.push({ id: m.id, reason: e instanceof Error ? e.message : String(e) });
    }
    await sleep(120);
  }

  return NextResponse.json({
    total: meetings.length,
    deleted,
    failed: errors.length,
    errors,
  });
}
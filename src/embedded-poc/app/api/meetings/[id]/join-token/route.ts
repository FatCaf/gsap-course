import { NextRequest, NextResponse } from "next/server";
import { getMeeting, getZak, signature, SDK_KEY } from "@/lib/zoom";
import { getZoomAccessToken } from "@/lib/zoom-session";

// GET /api/meetings/:id/join-token -> everything the embedded SDK needs.
// Connected user => host (role 1 + zak). Anonymous => participant (role 0).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const token = await getZoomAccessToken();

  let password = "";
  let zak: string | undefined;
  let role: 0 | 1 = 0;

  if (token) {
    // Host path: fetch real password + zak so embedded host can start it.
    const meeting = await getMeeting(token, id);
    password = meeting.password || "";
    try {
      zak = await getZak(token);
      role = 1;
    } catch (e) {
      // Missing user:read:token scope (or revoked) — fall back to participant
      // so the meeting still loads instead of 500ing the page.
      console.warn("zak fetch failed, joining as participant:", e);
      role = 0;
    }
  }

  return NextResponse.json({
    zoom_meeting_id: id,
    password,
    sdk_key: SDK_KEY,
    signature: signature(id, role),
    zak,
  });
}
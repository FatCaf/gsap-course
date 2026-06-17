import { NextRequest, NextResponse } from "next/server";
import { getZak, signature, SDK_KEY, derivePasscode } from "@/lib/zoom";
import { getZoomAccessToken } from "@/lib/zoom-session";

// GET /api/meetings/:id/join-token -> everything the embedded SDK needs.
// Connected user => host (role 1 + zak). Anonymous => participant (role 0).
// Passcode is deterministic from the id (set at create), so no store needed.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const token = await getZoomAccessToken();

  const password = derivePasscode(id);
  let zak: string | undefined;
  let role: 0 | 1 = 0;

  if (token) {
    try {
      zak = await getZak(token); // host can start the meeting
      role = 1;
    } catch (e) {
      // Missing user:read:token scope (or revoked) — join as participant
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
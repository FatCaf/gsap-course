import { headers, cookies } from "next/headers";
import { ZoomMeeting } from "@/components/ZoomMeeting";

async function getJoinToken(meetingId: string) {
  // Server component fetch: need absolute URL + manual cookie forward
  // (Next does not auto-forward browser cookies server-side).
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host")!;
  const proto = h.get("x-forwarded-proto") || "http";
  const base = process.env.NEXT_PUBLIC_API_URL || `${proto}://${host}`;

  const res = await fetch(`${base}/api/meetings/${meetingId}/join-token`, {
    headers: { cookie: cookies().toString() },
    cache: "no-store",
  });
  return res.json();
}

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const token = await getJoinToken(id);

  return (
    <ZoomMeeting
      zoomMeetingId={token.zoom_meeting_id}
      password={token.password}
      signature={token.signature}
      sdkKey={token.sdk_key}
      zak={token.zak}
      userName="Current User"   // replace with actual session user name
      userEmail="user@example.com"  // replace with actual session user email
    />
  );
}
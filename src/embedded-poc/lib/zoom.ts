import jwt from "jsonwebtoken";

// Zoom OAuth app creds (General/OAuth app).
const CLIENT_ID = process.env.ZOOM_CLIENT_ID!;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET!;

// Meeting SDK creds. If you use a single General app that is also Meeting-SDK
// enabled, these equal the OAuth client id/secret. Override if you have a
// dedicated Meeting SDK app.
export const SDK_KEY = process.env.ZOOM_SDK_KEY || CLIENT_ID;
const SDK_SECRET = process.env.ZOOM_SDK_SECRET || CLIENT_SECRET;

export const REDIRECT_URI =
  process.env.ZOOM_REDIRECT_URI || "http://localhost:3000/zoom/callback";

const ZOOM_OAUTH = "https://zoom.us/oauth";
const ZOOM_API = "https://api.zoom.us/v2";

// Granular scopes needed: create/read meetings + read host ZAK token.
const SCOPES = [
  "meeting:write:meeting",
  "meeting:read:meeting",
  "user:read:token",
].join(" ");

export function authorizeUrl(state?: string) {
  const u = new URL(`${ZOOM_OAUTH}/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("scope", SCOPES);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

function basicAuth() {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export interface ZoomToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeCode(code: string): Promise<ZoomToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch(`${ZOOM_OAUTH}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshToken(refresh_token: string): Promise<ZoomToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
  });
  const res = await fetch(`${ZOOM_OAUTH}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`token refresh failed: ${await res.text()}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function zoomFetch(
  token: string,
  path: string,
  init?: RequestInit,
  retries = 4,
): Promise<any> {
  const res = await fetch(`${ZOOM_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  // 429 rate limit — back off (honor Retry-After) and retry.
  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 1100;
    await sleep(wait);
    return zoomFetch(token, path, init, retries - 1);
  }

  if (!res.ok) throw new Error(`zoom ${path} ${res.status}: ${await res.text()}`);
  // DELETE and some endpoints return 204 / empty body — don't parse as JSON.
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function createMeeting(token: string, topic: string) {
  return zoomFetch(token, "/users/me/meetings", {
    method: "POST",
    body: JSON.stringify({ topic, type: 2 }), // 2 = scheduled
  });
}

export async function getMeeting(token: string, meetingId: string) {
  return zoomFetch(token, `/meetings/${meetingId}`);
}

interface MeetingListItem {
  id: number;
  topic: string;
}

// List all of the current user's meetings (paginated). type: scheduled |
// upcoming | upcoming_meetings | previous_meetings.
export async function listMeetings(
  token: string,
  type: "scheduled" | "upcoming" | "upcoming_meetings" | "previous_meetings" = "scheduled",
): Promise<MeetingListItem[]> {
  const out: MeetingListItem[] = [];
  let next = "";
  do {
    const q = new URLSearchParams({ type, page_size: "300" });
    if (next) q.set("next_page_token", next);
    const data = await zoomFetch(token, `/users/me/meetings?${q}`);
    out.push(...(data.meetings || []));
    next = data.next_page_token || "";
  } while (next);
  return out;
}

export async function deleteMeeting(token: string, meetingId: string | number) {
  return zoomFetch(token, `/meetings/${meetingId}`, { method: "DELETE" });
}

// Host ZAK token — required so the embedded host can start the meeting.
export async function getZak(token: string): Promise<string> {
  const data = await zoomFetch(token, "/users/me/token?type=zak");
  return data.token;
}

// Meeting SDK signature (JWT, HS256). role: 1 = host, 0 = participant.
export function signature(meetingNumber: string, role: 0 | 1) {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2h
  return jwt.sign(
    {
      appKey: SDK_KEY,
      sdkKey: SDK_KEY,
      mn: meetingNumber,
      role,
      iat,
      exp,
      tokenExp: exp,
    },
    SDK_SECRET,
    { algorithm: "HS256" },
  );
}
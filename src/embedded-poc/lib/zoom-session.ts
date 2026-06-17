import { cookies } from "next/headers";
import { refreshToken } from "@/lib/zoom";

// Returns a valid Zoom access token for the current user, refreshing if the
// access cookie is gone but a refresh cookie remains. null = not connected.
// POC: tokens live in cookies. Production: store per-user in a DB.
export async function getZoomAccessToken(): Promise<string | null> {
  const store = cookies();
  const access = store.get("zoom_access_token")?.value;
  if (access) return access;

  const refresh = store.get("zoom_refresh_token")?.value;
  if (!refresh) return null;

  try {
    const t = await refreshToken(refresh);
    // Note: can't Set-Cookie from a plain helper; persist in the route if
    // needed. For POC the fresh access token is returned for immediate use.
    return t.access_token;
  } catch {
    return null;
  }
}
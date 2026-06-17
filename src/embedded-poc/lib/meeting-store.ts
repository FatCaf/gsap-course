// POC meeting store: maps meetingId -> passcode so participants can join with
// only the meeting ID (passcode fetch otherwise needs the host's token).
// In-memory — wiped on server restart / dev hot-reload. Use a DB in production.
const store = new Map<string, { password: string }>();

export function saveMeeting(id: string | number, password: string) {
  store.set(String(id), { password: password || "" });
}

export function getStoredMeeting(id: string | number) {
  return store.get(String(id));
}
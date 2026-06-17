"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Lazy + client-only: heavy Zoom SDK stays out of the initial page bundle.
const ZoomMeeting = dynamic(
  () => import("@/components/ZoomMeeting").then((m) => m.ZoomMeeting),
  { ssr: false },
);

// Same treatment for the Stream SDK — only pulled in when a call mounts.
const StreamVideoProvider = dynamic(
  () => import("@/components/StreamVideoProvider").then((m) => m.StreamVideoProvider),
  { ssr: false },
);
const StreamMeetingRoom = dynamic(
  () => import("@/components/StreamMeetingRoom").then((m) => m.StreamMeetingRoom),
  { ssr: false },
);

// Empty = same-origin. Guards against NEXT_PUBLIC_API_URL being unset on
// Vercel (undefined would produce "/undefined/api/..." 404s).
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface JoinToken {
  zoom_meeting_id: string;
  password: string;
  sdk_key: string;
  signature: string;
  zak?: string;
}

export default function Home() {
  const [twitchUser, setTwitchUser] = useState("monstercat");
  const [youtubeId, setYoutubeId] = useState("jfKfPfyJRdk");
  const [streamyardId, setStreamyardId] = useState("");
  const [activeTab, setActiveTab] = useState<"youtube" | "twitch" | "streamyard" | "zoom" | "stream">("youtube");

  // Stream (GetStream.io) state
  const [streamUserId, setStreamUserId] = useState("");
  const [streamLink, setStreamLink] = useState(""); // pasted/generated call link or raw id
  const [streamCallId, setStreamCallId] = useState(""); // active call id once joined
  const [streamCopied, setStreamCopied] = useState(false);

  // Persist a stable per-browser user id so the SDK token stays consistent.
  useEffect(() => {
    const stored = localStorage.getItem("stream_user_id");
    const id = stored || `user-${Math.random().toString(36).slice(2, 10)}`;
    if (!stored) localStorage.setItem("stream_user_id", id);
    setStreamUserId(id);
  }, []);

  // Accept a full URL (".../call/<id>") or a raw id; return the call id.
  const parseCallId = (link: string) => {
    const m = link.trim().match(/\/call\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : link.trim();
  };

  // Generate a new call link, drop it in the input, and copy to clipboard.
  const createStreamLink = () => {
    const id = `call-${Math.random().toString(36).slice(2, 10)}`;
    const url = `${window.location.origin}/call/${id}`;
    setStreamLink(url);
    navigator.clipboard.writeText(url).then(() => {
      setStreamCopied(true);
      setTimeout(() => setStreamCopied(false), 1500);
    });
  };

  // Join the call referenced by the input, rendering it on this page.
  const joinStreamLink = () => {
    const id = parseCallId(streamLink);
    if (!id) return;
    setStreamCallId(id);
    setActiveTab("stream");
  };

  // Zoom state
  const [zoomMeetingId, setZoomMeetingId] = useState("");
  const [zoomToken, setZoomToken] = useState<JoinToken | null>(null);
  const [zoomBusy, setZoomBusy] = useState(false);
  const [zoomError, setZoomError] = useState<string | null>(null);

  // Helper to extract YouTube ID from a full URL if a user pastes one
  const handleYoutubeInput = (input: string) => {
    const idMatch = input.match(/(?:youtu\.be\/|youtube\.exe\/|v=|embed\/|u\/\w\/|shorts\/)([^#&?]*)/);
    setYoutubeId(idMatch && idMatch[1].length === 11 ? idMatch[1] : input);
  };

  // Helper to extract StreamYard ID from a full URL
  const handleStreamyardInput = (input: string) => {
    // StreamYard links look like https://streamyard.com/watch/ID or just the ID
    const idMatch = input.match(/streamyard\.com\/watch\/([^#&?]*)/);
    setStreamyardId(idMatch ? idMatch[1] : input);
  };

  // Fetch the embedded-SDK join token for a meeting id, then show the meeting
  const joinZoom = async (meetingId: string) => {
    if (!meetingId) return;
    setZoomBusy(true);
    setZoomError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meetings/${meetingId}/join-token`, {
        credentials: "include",
      });
      const data: JoinToken = await res.json();
      setZoomToken(data);
      setActiveTab("zoom");
    } catch {
      setZoomError("Failed to fetch join token");
    } finally {
      setZoomBusy(false);
    }
  };

  // Delete ALL the connected host's scheduled meetings
  const deleteAllZoom = async () => {
    if (!confirm("Delete ALL your scheduled Zoom meetings?")) return;
    setZoomBusy(true);
    setZoomError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meetings`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.error === "zoom_not_connected") {
        window.location.href = `${API_BASE}/zoom/connect`;
        return;
      }
      console.log("delete result", data);
      const firstErr = data.errors?.[0]?.reason ? ` — ${data.errors[0].reason}` : "";
      setZoomError(`Deleted ${data.deleted}/${data.total}${data.failed ? `, ${data.failed} failed${firstErr}` : ""}`);
    } catch {
      setZoomError("Failed to delete meetings");
    } finally {
      setZoomBusy(false);
    }
  };

  // Create a new meeting (host must have connected Zoom), then join it
  const createZoom = async () => {
    setZoomBusy(true);
    setZoomError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meetings`, {
        method: "POST",
        body: new URLSearchParams({ topic: "My Meeting" }),
        credentials: "include",
      });
      const data = await res.json();
      console.log("createMeeting response", res.status, data);
      if (data.error === "zoom_not_connected") {
        window.location.href = `${API_BASE}/zoom/connect`;
        return;
      }
      if (!res.ok || data.error) {
        setZoomError(`Create failed (${res.status}): ${data.detail || data.error || "unknown"}`);
        setZoomBusy(false);
        return;
      }
      setZoomMeetingId(data.zoom_meeting_id);
      await joinZoom(data.zoom_meeting_id);
    } catch (e) {
      console.error("createMeeting client error", e);
      setZoomError(`Failed to create meeting: ${e instanceof Error ? e.message : String(e)}`);
      setZoomBusy(false);
    }
  };

  // Build the URLs dynamically
  const twitchUrl = `https://player.twitch.tv/?channel=${twitchUser}&parent=localhost&autoplay=true`;
  const youtubeUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
  const streamyardUrl = `https://streamyard.com/watch/${streamyardId}?embed=true`;

  const getUrl = () => {
    switch (activeTab) {
      case "youtube": return youtubeUrl;
      case "twitch": return twitchUrl;
      case "streamyard": return streamyardUrl;
      default: return "";
    }
  };

  const currentUrl = getUrl();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {/* Sidebar: 15% width */}
      <aside className="w-[15%] min-w-[200px] border-r border-zinc-800 flex flex-col gap-6 p-4 bg-zinc-950 overflow-y-auto">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Controls</h2>

          {/* YouTube Config */}
          <div className="mb-6">
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">YouTube URL or ID</label>
            <input
              type="text"
              placeholder="e.g. jfKfPfyJRdk"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-red-500"
              onChange={(e) => handleYoutubeInput(e.target.value)}
            />
            <button
              onClick={() => setActiveTab("youtube")}
              className={`w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all ${
                activeTab === "youtube" ? "bg-red-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              Play YouTube
            </button>
          </div>

          {/* Twitch Config */}
          <div className="mb-6">
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">Twitch Username</label>
            <input
              type="text"
              placeholder="e.g. monstercat"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
              value={twitchUser}
              onChange={(e) => setTwitchUser(e.target.value)}
            />
            <button
              onClick={() => setActiveTab("twitch")}
              className={`w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all ${
                activeTab === "twitch" ? "bg-purple-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              Play Twitch
            </button>
          </div>

          {/* StreamYard Config */}
          <div className="mb-6">
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">StreamYard URL or ID</label>
            <input
              type="text"
              placeholder="Paste StreamYard link"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
              onChange={(e) => handleStreamyardInput(e.target.value)}
            />
            <button
              onClick={() => setActiveTab("streamyard")}
              className={`w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all ${
                activeTab === "streamyard" ? "bg-blue-500 text-white" : "hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              Play StreamYard
            </button>
          </div>

          {/* Zoom Config */}
          <div>
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">Zoom Meeting ID</label>
            <input
              type="text"
              placeholder="e.g. 1234567890"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-sky-500"
              value={zoomMeetingId}
              onChange={(e) => setZoomMeetingId(e.target.value)}
            />
            <button
              onClick={() => joinZoom(zoomMeetingId)}
              disabled={zoomBusy || !zoomMeetingId}
              className={`w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all disabled:opacity-40 ${
                activeTab === "zoom" ? "bg-sky-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              {zoomBusy ? "Loading…" : "Join Zoom"}
            </button>
            <button
              onClick={createZoom}
              disabled={zoomBusy}
              className="w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all border border-sky-700 text-sky-300 hover:bg-sky-900/40 disabled:opacity-40"
            >
              Create Meeting (host)
            </button>
            <button
              onClick={deleteAllZoom}
              disabled={zoomBusy}
              className="w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all border border-red-800 text-red-400 hover:bg-red-900/40 disabled:opacity-40"
            >
              Delete all meetings
            </button>
            {zoomError && <p className="mt-2 text-[10px] text-red-400">{zoomError}</p>}
          </div>

          {/* Stream (GetStream.io) — shareable 1:1 & group video calls */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">Video Call</label>
            <button
              onClick={createStreamLink}
              className="w-full mt-1 py-2 px-3 text-left rounded-md text-sm transition-all border border-emerald-700 text-emerald-300 hover:bg-emerald-900/40"
            >
              {streamCopied ? "Link copied!" : "Create shareable call"}
            </button>

            <label className="block text-[10px] text-zinc-400 mt-3 mb-1 uppercase">Call Link</label>
            <input
              type="text"
              placeholder="Paste call link or id"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
              value={streamLink}
              onChange={(e) => setStreamLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinStreamLink()}
            />
            <button
              onClick={joinStreamLink}
              disabled={!streamLink.trim() || !streamUserId}
              className={`w-full mt-2 py-2 px-3 text-left rounded-md text-sm transition-all disabled:opacity-40 ${
                activeTab === "stream" ? "bg-emerald-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              Join Call
            </button>
            <p className="mt-1 text-[9px] text-zinc-600">
              Create copies a link to clipboard. Paste any call link to join here.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-black relative">
        {activeTab === "stream" ? (
          streamCallId && streamUserId && (
            <StreamVideoProvider userId={streamUserId}>
              <StreamMeetingRoom callId={streamCallId} />
            </StreamVideoProvider>
          )
        ) : activeTab === "zoom" ? (
          zoomToken && (
            <ZoomMeeting
              zoomMeetingId={zoomToken.zoom_meeting_id}
              password={zoomToken.password}
              signature={zoomToken.signature}
              sdkKey={zoomToken.sdk_key}
              zak={zoomToken.zak}
              userName="Current User"
              userEmail="user@example.com"
            />
          )
        ) : (
          currentUrl && (
            <iframe
              key={currentUrl} // Key forces iframe to reload when URL changes
              src={currentUrl}
              className="w-full h-full border-0"
              title="Stream Player"
            />
          )
        )}
      </main>
    </div>
  );
}
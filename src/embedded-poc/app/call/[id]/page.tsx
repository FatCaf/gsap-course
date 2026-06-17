"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Heavy Stream SDK stays out of the bundle until the call mounts.
const StreamVideoProvider = dynamic(
  () => import("@/components/StreamVideoProvider").then((m) => m.StreamVideoProvider),
  { ssr: false },
);
const StreamMeetingRoom = dynamic(
  () => import("@/components/StreamMeetingRoom").then((m) => m.StreamMeetingRoom),
  { ssr: false },
);

// /call/<id> — open this link, pick a name, join. Share the URL with anyone.
export default function CallPage({ params }: { params: { id: string } }) {
  const callId = decodeURIComponent(params.id);

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  // Stable per-browser user id so the SDK token stays consistent across reloads.
  useEffect(() => {
    const stored = localStorage.getItem("stream_user_id");
    const id = stored || `user-${Math.random().toString(36).slice(2, 10)}`;
    if (!stored) localStorage.setItem("stream_user_id", id);
    setUserId(id);
    setName(localStorage.getItem("stream_user_name") || "");
  }, []);

  const join = () => {
    if (name.trim()) localStorage.setItem("stream_user_name", name.trim());
    setJoined(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (joined && userId) {
    return (
      <div className="h-screen w-screen bg-black text-white">
        <StreamVideoProvider userId={userId} userName={name || userId}>
          <StreamMeetingRoom callId={callId} />
        </StreamVideoProvider>
      </div>
    );
  }

  // Lobby — enter a name before joining.
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white font-sans">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-lg font-bold">Join call</h1>
        <p className="mt-1 text-xs text-zinc-500">Room: {callId}</p>

        <label className="mt-5 block text-[10px] uppercase text-zinc-400">Your name</label>
        <input
          autoFocus
          type="text"
          placeholder="e.g. Mykyta"
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />

        <button
          onClick={join}
          disabled={!userId}
          className="mt-4 w-full rounded-md bg-emerald-600 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
        >
          Join
        </button>
        <button
          onClick={copyLink}
          className="mt-2 w-full rounded-md border border-zinc-700 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
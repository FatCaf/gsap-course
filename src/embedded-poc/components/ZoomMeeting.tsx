"use client";
import { useEffect, useRef } from "react";

interface Props {
  zoomMeetingId: string;
  password: string;
  signature: string;
  sdkKey: string;
  zak?: string;
  userName: string;
  userEmail: string;
}

export function ZoomMeeting({ zoomMeetingId, password, signature, sdkKey, zak, userName, userEmail }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cleanup = () => {};

    // Dynamic import keeps the heavy SDK out of the page bundle — loaded only
    // when a meeting actually mounts.
    (async () => {
      // CJS module under Turbopack interop: createClient may sit on .default,
      // .default.default, or the namespace itself. Pick whichever has it.
      const mod = (await import("@zoom/meetingsdk/embedded")) as any;
      const ZoomMtgEmbedded =
        typeof mod.createClient === "function"
          ? mod
          : typeof mod.default?.createClient === "function"
            ? mod.default
            : mod.default?.default;
      const client = ZoomMtgEmbedded.createClient();

      await client.init({ zoomAppRoot: containerRef.current!, language: "en-US" });

      await client.join({
        meetingNumber: zoomMeetingId,
        password,
        signature,
        sdkKey,
        userName,
        userEmail,
        zak, // undefined for participants — Zoom ignores it
      });

      cleanup = () => { client.leaveMeeting(); };
    })();

    return () => cleanup();
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />;
}
"use client";

import { ReactNode, useEffect, useState } from "react";
import { StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

interface Props {
  userId: string;
  userName?: string;
  children: ReactNode;
}

// Connects a single user to Stream and exposes the client via context. The
// tokenProvider re-fetches automatically when the JWT expires.
export function StreamVideoProvider({ userId, userName, children }: Props) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);

  useEffect(() => {
    const tokenProvider = async () => {
      const res = await fetch(`/api/stream-token?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      return data.token as string;
    };

    const c = new StreamVideoClient({
      apiKey,
      user: { id: userId, name: userName || userId },
      tokenProvider,
    });

    setClient(c);
    return () => {
      c.disconnectUser().catch(console.error);
      setClient(null);
    };
  }, [userId, userName]);

  if (!client) return null;

  return <StreamVideo client={client}>{children}</StreamVideo>;
}
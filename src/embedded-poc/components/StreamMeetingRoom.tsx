"use client";

import { useEffect, useState } from "react";
import {
  StreamCall,
  StreamTheme,
  SpeakerLayout,
  PaginatedGridLayout,
  CallControls,
  useStreamVideoClient,
  CallingState,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import type { Call } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

function MeetingUI() {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();

  if (callingState === CallingState.JOINING) return <p className="p-4">Joining…</p>;
  if (callingState !== CallingState.JOINED) return <p className="p-4">Connecting…</p>;

  return (
    <StreamTheme className="h-full">
      {/* Grid for groups (3+), speaker view for 1:1 */}
      {participants.length > 2 ? (
        <PaginatedGridLayout />
      ) : (
        <SpeakerLayout participantsBarPosition="bottom" />
      )}
      <CallControls />
    </StreamTheme>
  );
}

interface Props {
  callId: string;
  // Optional members to seed a group call on create (1:1 just needs 2 to join).
  memberIds?: string[];
}

// "default" call type handles both 1:1 and group. The room creates the call on
// join if it doesn't exist, so no separate server-side create route is needed.
export function StreamMeetingRoom({ callId, memberIds }: Props) {
  const client = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    if (!client) return;

    const c = client.call("default", callId);
    c.join({
      create: true,
      data: memberIds?.length
        ? { members: memberIds.map((id) => ({ user_id: id })) }
        : undefined,
    }).then(() => setCall(c));

    return () => {
      c.leave().catch(console.error);
      setCall(null);
    };
  }, [client, callId, memberIds]);

  if (!call) return <p className="p-4">Loading call…</p>;

  return (
    <StreamCall call={call}>
      <MeetingUI />
    </StreamCall>
  );
}
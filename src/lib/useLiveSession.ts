"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { channelName, recordAnswer, type LiveAnswer, type LiveState, type Participant, type Tally } from "@/lib/liveSession";

const BROADCAST = "broadcast" as const;

function send(channel: RealtimeChannel | null, event: string, payload: object) {
  channel?.send({ type: BROADCAST, event, payload });
}

/**
 * Côté enseignant : diffuse l'état de la présentation, le renvoie à chaque
 * élève qui arrive (un broadcast n'est pas rejoué aux retardataires) et
 * collecte les réponses.
 */
export function useLiveHost(code: string, state: LiveState) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tally, setTally] = useState<Tally>({});
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    const channel = supabase.channel(channelName(code), { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on(BROADCAST, { event: "answer" }, ({ payload }) => {
        setTally((t) => recordAnswer(t, payload as LiveAnswer));
      })
      .on("presence", { event: "sync" }, () => {
        const seen = new Map<string, Participant>();
        for (const metas of Object.values(channel.presenceState<Participant>())) {
          for (const meta of metas) if (meta.id) seen.set(meta.id, { id: meta.id, name: meta.name });
        }
        setParticipants([...seen.values()]);
      })
      .on("presence", { event: "join" }, () => send(channel, "state", stateRef.current))
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      send(channel, "end", {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code]);

  useEffect(() => {
    stateRef.current = state;
    if (connected) send(channelRef.current, "state", state);
  }, [state, connected]);

  return { participants, tally, connected };
}

export type GuestStatus = "connecting" | "waiting" | "live" | "ended";

/** Côté élève : suit l'état diffusé par l'enseignant et envoie ses réponses. */
export function useLiveGuest(code: string, me: Participant) {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<GuestStatus>("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { id, name } = me;

  useEffect(() => {
    const channel = supabase.channel(channelName(code), { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on(BROADCAST, { event: "state" }, ({ payload }) => {
        setState(payload as LiveState);
        setStatus("live");
      })
      .on(BROADCAST, { event: "end" }, () => setStatus("ended"))
      .subscribe((subscription) => {
        if (subscription !== "SUBSCRIBED") return;
        setStatus((s) => (s === "connecting" ? "waiting" : s));
        channel.track({ id, name });
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, id, name]);

  const sendAnswer = useCallback(
    (slideIndex: number, choiceId: string, correct: boolean) => {
      const answer: LiveAnswer = { slideIndex, studentId: id, name, choiceId, correct };
      send(channelRef.current, "answer", answer);
    },
    [id, name],
  );

  return { state, status, sendAnswer };
}

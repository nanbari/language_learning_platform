"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseBrowser";
import { buildTally, LIVE_TOKEN_REFRESH_SECONDS, type LiveState, type Participant, type Tally } from "@/lib/liveSession";
import type { LivePokeEvent } from "@/server/livePoke";
import { ApiError } from "@/lib/api/client";
import { fetchLiveAnswers, fetchLiveState, fetchLiveToken, pushLiveState, sendLiveAnswer, type LiveTokenResponse } from "@/lib/api/live";

/**
 * Séance en direct, côté navigateur. Voir lib/liveSession : l'état et les
 * réponses passent par les routes API ; le canal Realtime privé ne sert
 * qu'à prévenir qu'il y a du neuf, et à l'appel vidéo.
 */

/** Relecture périodique, même sans signal (canal indisponible, message perdu). */
const GUEST_POLL_MS = 3000;
const HOST_POLL_MS = 2500;
/** Nouvel essai de jeton après une erreur réseau. */
const TOKEN_RETRY_MS = 20_000;

export type LiveLinkStatus =
  | "loading"
  /** Jeton obtenu, canal de contrôle ouvert. */
  | "ready"
  /** Le serveur n'émet pas de jeton (503) : pas de vidéo ni de signal, la relecture périodique suffit. */
  | "unavailable"
  /** Refusé : plus membre de la classe, ou cours terminé. */
  | "denied";

export interface LiveLink {
  status: LiveLinkStatus;
  token: string | null;
  topics: LiveTokenResponse["topics"] | null;
  teacherId: string | null;
  /** Reçoit les signaux du serveur (état, réponses, fin, micro coupé). */
  subscribe: (listener: (event: LivePokeEvent) => void) => () => void;
}

/**
 * Jeton Realtime de la séance et canal de contrôle. Le jeton est renouvelé
 * avant d'expirer ; le serveur revérifie alors l'appartenance à la classe.
 */
export function useLiveLink(classId: string, room: string): LiveLink {
  const [status, setStatus] = useState<LiveLinkStatus>("loading");
  const [grant, setGrant] = useState<LiveTokenResponse | null>(null);
  const listeners = useRef(new Set<(event: LivePokeEvent) => void>());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const obtain = async () => {
      try {
        const next = await fetchLiveToken(classId, room);
        if (cancelled) return;
        await supabase.realtime.setAuth(next.token);
        setGrant(next);
        setStatus("ready");
        timer = setTimeout(obtain, LIVE_TOKEN_REFRESH_SECONDS * 1000);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) { setStatus("denied"); setGrant(null); return; }
        if (e instanceof ApiError && e.status === 503) { setStatus("unavailable"); setGrant(null); return; }
        timer = setTimeout(obtain, TOKEN_RETRY_MS);
      }
    };
    void obtain();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void supabase.realtime.setAuth(null);
    };
  }, [classId, room]);

  const topic = grant?.topics.control ?? null;
  useEffect(() => {
    if (!topic) return;
    const channel: RealtimeChannel = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } });
    const relay = (event: LivePokeEvent) => () => listeners.current.forEach((l) => l(event));
    channel
      .on("broadcast", { event: "state" }, relay("state"))
      .on("broadcast", { event: "answers" }, relay("answers"))
      .on("broadcast", { event: "end" }, relay("end"))
      .on("broadcast", { event: "muteAll" }, relay("muteAll"))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [topic]);

  const subscribe = useCallback((listener: (event: LivePokeEvent) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  return useMemo<LiveLink>(() => ({
    status,
    token: grant?.token ?? null,
    topics: grant?.topics ?? null,
    teacherId: grant?.teacherId ?? null,
    subscribe,
  }), [status, grant, subscribe]);
}

/**
 * Relit `refresh` à intervalle régulier et dès qu'un des `events` arrive.
 * Jamais deux relectures en même temps.
 */
function useRefreshLoop(refresh: () => Promise<void>, intervalMs: number, link: LiveLink, events: readonly LivePokeEvent[]) {
  const busy = useRef(false);
  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try { await refresh(); } finally { busy.current = false; }
  }, [refresh]);

  useEffect(() => {
    void run();
    const timer = setInterval(run, intervalMs);
    const stop = link.subscribe((event) => { if (events.includes(event)) void run(); });
    return () => { clearInterval(timer); stop(); };
  }, [run, intervalMs, link, events]);
}

/**
 * Côté enseignant : dépose chaque changement d'écran, relit les réponses et
 * les présences. `connected` : le dernier dépôt a abouti.
 */
export function useLiveHost(classId: string, room: string, state: LiveState, link: LiveLink) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tally, setTally] = useState<Tally>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let stale = false;
    pushLiveState(classId, room, state)
      .then(() => { if (!stale) setConnected(true); })
      .catch(() => { if (!stale) setConnected(false); });
    return () => { stale = true; };
  }, [classId, room, state]);

  const refresh = useCallback(async () => {
    try {
      const view = await fetchLiveAnswers(classId, room);
      setTally(buildTally(view.answers));
      setParticipants(view.participants);
    } catch { /* prochaine relecture */ }
  }, [classId, room]);
  useRefreshLoop(refresh, HOST_POLL_MS, link, HOST_EVENTS);

  return { participants, tally, connected };
}
const HOST_EVENTS: readonly LivePokeEvent[] = ["answers"];

export type GuestStatus =
  | "connecting"
  /** Dans la salle, l'enseignant n'a encore rien affiché. */
  | "waiting"
  | "live"
  | "ended"
  /** Le serveur refuse : plus membre de la classe, ou cours inexistant. */
  | "denied";

/** Côté élève : suit l'écran déposé par l'enseignant et envoie ses essais. */
export function useLiveGuest(classId: string, room: string, link: LiveLink) {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<GuestStatus>("connecting");

  const refresh = useCallback(async () => {
    try {
      const view = await fetchLiveState(classId, room);
      if (view.status === "ended") { setStatus("ended"); return; }
      setState(view.state);
      setStatus(view.state ? "live" : "waiting");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setStatus("denied");
      // Réseau ou serveur indisponible : on garde le dernier écran, prochaine relecture.
    }
  }, [classId, room]);
  useRefreshLoop(refresh, GUEST_POLL_MS, link, GUEST_EVENTS);

  const sendAnswer = useCallback(
    (slideIndex: number, choiceId: string) => {
      // L'exactitude est établie par le serveur ; l'écran de l'élève la montre déjà.
      // Un essai perdu (réseau) ne bloque pas le jeu : l'élève peut rejouer.
      void sendLiveAnswer(classId, room, slideIndex, choiceId).catch(() => {});
    },
    [classId, room],
  );

  return { state, status, sendAnswer };
}
const GUEST_EVENTS: readonly LivePokeEvent[] = ["state", "end"];

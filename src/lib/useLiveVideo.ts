"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { channelName } from "@/lib/liveSession";

/**
 * Appel vidéo du cours en direct, façon visioconférence : l'enseignant et
 * les élèves (7 au plus) se voient et s'entendent tous. Chaque participant
 * est relié directement à chacun des autres en WebRTC (maillage) ; un canal
 * Supabase Realtime à part sert seulement à la mise en relation, l'image et
 * le son ne transitent pas par Supabase.
 *
 * Qui est dans l'appel : la présence du canal. Chaque ouverture de page y
 * figure avec un identifiant de session tiré au hasard, qui sert de clé
 * partout (un rechargement ou une deuxième fenêtre de la même personne est
 * un autre participant). Entre deux sessions, c'est la plus petite qui appelle.
 *
 * Messages du canal :
 * - `offer` / `answer` : description de session complète (candidats ICE inclus) ;
 * - `media` : caméra / micro allumés ou coupés ;
 * - `muteAll` (enseignant) : coupe le micro de tous les élèves.
 */

export type CallRole = "teacher" | "student";

export interface CallMember {
  id: string;
  name: string;
  role: CallRole;
}

export interface CallPeer extends CallMember {
  /** Une même personne peut être là deux fois (deux fenêtres) : on distingue les sessions. */
  session: string;
  stream: MediaStream;
  cam: boolean;
  mic: boolean;
}

const BROADCAST = "broadcast" as const;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

/** Au-delà, on envoie les candidats déjà trouvés plutôt que de faire attendre. */
const ICE_GATHERING_TIMEOUT_MS = 2500;
/** Nouvel essai après une connexion échouée. */
const RETRY_MS = 2000;

/**
 * Chacun envoie sa vidéo à tous les autres : l'image des élèves reste petite
 * pour ménager leur connexion, celle de l'enseignant est plus nette.
 */
const VIDEO: Record<CallRole, { width: number; height: number; frameRate: number; kbps: number }> = {
  teacher: { width: 640, height: 480, frameRate: 24, kbps: 600 },
  student: { width: 320, height: 240, frameRate: 15, kbps: 250 },
};

/** Ce que chacun publie dans la présence du canal. */
interface Member extends CallMember {
  session: string;
  cam: boolean;
  mic: boolean;
}

interface Signal {
  from: Member;
  to: string;
  call: number;
  sdp: RTCSessionDescriptionInit;
}

interface Link {
  pc: RTCPeerConnection;
  call: number;
}

function send(channel: RealtimeChannel | null, event: string, payload: object) {
  channel?.send({ type: BROADCAST, event, payload });
}

/** Attend la fin de la collecte des candidats ICE, pour n'échanger qu'un message de chaque côté. */
function iceGathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => { if (pc.iceGatheringState === "complete") done(); };
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function limitBitrate(pc: RTCPeerConnection, kbps: number) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    const params = sender.getParameters();
    if (!params.encodings?.length) continue;
    params.encodings[0].maxBitrate = kbps * 1000;
    sender.setParameters(params).catch(() => {});
  }
}

function presentMembers(channel: RealtimeChannel): Member[] {
  return Object.values(channel.presenceState<Member>()).flat().filter((m) => m.session);
}

export function useVideoCall(code: string, me: CallMember) {
  const { id, name, role } = me;
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<CallPeer[]>([]);
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const sessionRef = useRef("");
  const localRef = useRef<MediaStream | null>(null);
  const links = useRef(new Map<string, Link>());
  const callCount = useRef(0);
  const mediaState = useRef({ cam: true, mic: true });

  /** Branche nos pistes locales (s'il y en a) sur les émetteurs d'une connexion. */
  const attachLocal = useCallback((pc: RTCPeerConnection) => {
    const media = localRef.current;
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver.track.kind;
      const track = media?.getTracks().find((m) => m.kind === kind) ?? null;
      t.direction = "sendrecv";
      t.sender.replaceTrack(track).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const session = crypto.randomUUID();
    const channel = supabase.channel(`${channelName(code)}-video`, {
      config: { broadcast: { self: false }, presence: { key: session } },
    });
    channelRef.current = channel;
    sessionRef.current = session;
    const all = links.current;
    let closed = false;

    const updatePeer = (key: string, change: (p: CallPeer) => CallPeer) =>
      setPeers((list) => list.map((p) => (p.session === key ? change(p) : p)));

    const drop = (key: string) => {
      all.get(key)?.pc.close();
      all.delete(key);
      setPeers((list) => list.filter((p) => p.session !== key));
    };

    /** Nouvelle connexion vers `member` ; remplace l'éventuelle précédente. */
    const openLink = (member: Member, call: number) => {
      const key = member.session;
      all.get(key)?.pc.close();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      all.set(key, { pc, call });

      const stream = new MediaStream();
      setPeers((list) => {
        const peer: CallPeer = { ...member, stream };
        return list.some((p) => p.session === key)
          ? list.map((p) => (p.session === key ? peer : p))
          : [...list, peer];
      });

      pc.ontrack = (e) => {
        if (all.get(key)?.pc !== pc) return;
        stream.getTracks().filter((t) => t.kind === e.track.kind).forEach((t) => stream.removeTrack(t));
        stream.addTrack(e.track);
        // Nouvel objet pour que les vignettes se mettent à jour.
        updatePeer(key, (p) => ({ ...p, stream: new MediaStream(stream.getTracks()) }));
      };
      pc.onconnectionstatechange = () => {
        if (all.get(key)?.pc !== pc) return;
        if (pc.connectionState === "connected") limitBitrate(pc, VIDEO[role].kbps);
        if (pc.connectionState === "failed") {
          drop(key);
          setTimeout(() => { if (!closed) reconcile(); }, RETRY_MS);
        }
      };
      return pc;
    };

    const self = (): Member => ({ id, name, role, session, ...mediaState.current });

    const callPeer = async (member: Member) => {
      const call = ++callCount.current;
      const pc = openLink(member, call);
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      attachLocal(pc);
      try {
        await pc.setLocalDescription(await pc.createOffer());
        await iceGathered(pc);
        if (all.get(member.session)?.pc !== pc || !pc.localDescription) return;
        const offer: Signal = { from: self(), to: member.session, call, sdp: pc.localDescription.toJSON() };
        send(channel, "offer", offer);
      } catch {
        if (all.get(member.session)?.pc === pc) drop(member.session);
      }
    };

    /** Appelle les participants présents qu'on n'a pas encore (ou plus) en ligne. */
    const reconcile = () => {
      for (const member of presentMembers(channel)) {
        if (member.session === session) continue;
        updatePeer(member.session, (p) => ({ ...p, cam: member.cam, mic: member.mic }));
        if (session < member.session && !all.has(member.session)) void callPeer(member);
      }
    };

    channel
      .on("presence", { event: "sync" }, reconcile)
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const still = presentMembers(channel);
        for (const left of leftPresences as unknown as Member[]) {
          if (!still.some((m) => m.session === left.session)) drop(left.session);
        }
      })
      .on(BROADCAST, { event: "offer" }, async ({ payload }) => {
        const { from, to, call, sdp } = payload as Signal;
        if (to !== session) return;
        const pc = openLink(from, call);
        try {
          await pc.setRemoteDescription(sdp);
          attachLocal(pc);
          await pc.setLocalDescription(await pc.createAnswer());
          await iceGathered(pc);
          if (all.get(from.session)?.pc !== pc || !pc.localDescription) return;
          send(channel, "answer", { from: self(), to: from.session, call, sdp: pc.localDescription.toJSON() } satisfies Signal);
        } catch {
          if (all.get(from.session)?.pc === pc) drop(from.session);
        }
      })
      .on(BROADCAST, { event: "answer" }, ({ payload }) => {
        const { from, to, call, sdp } = payload as Signal;
        const link = all.get(from.session);
        if (to !== session || link?.call !== call) return;
        link.pc.setRemoteDescription(sdp).catch(() => drop(from.session));
      })
      .on(BROADCAST, { event: "media" }, ({ payload }) => {
        const { from, cam: c, mic: m } = payload as { from: string; cam: boolean; mic: boolean };
        updatePeer(from, (p) => ({ ...p, cam: c, mic: m }));
      })
      .on(BROADCAST, { event: "muteAll" }, () => {
        if (role !== "student") return;
        localRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
        mediaState.current.mic = false;
        setMic(false);
        send(channel, "media", { from: session, ...mediaState.current });
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") void channel.track(self()); });

    return () => {
      closed = true;
      for (const { pc } of all.values()) pc.close();
      all.clear();
      setPeers([]);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, id, name, role, attachLocal]);

  // Caméra et micro dès l'entrée dans la séance ; sans eux, on regarde et on écoute quand même.
  useEffect(() => {
    let cancelled = false;
    const v = VIDEO[role];
    navigator.mediaDevices?.getUserMedia({
      video: { width: { ideal: v.width }, height: { ideal: v.height }, frameRate: { ideal: v.frameRate }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    }).then((media) => {
      if (cancelled) { media.getTracks().forEach((t) => t.stop()); return; }
      media.getVideoTracks().forEach((t) => { t.enabled = mediaState.current.cam; });
      media.getAudioTracks().forEach((t) => { t.enabled = mediaState.current.mic; });
      localRef.current = media;
      setLocal(media);
      for (const { pc } of links.current.values()) {
        if (pc.signalingState !== "closed") attachLocal(pc);
      }
    }).catch(() => {
      if (!cancelled) setError("Caméra ou micro inaccessible : autorise-les dans le navigateur pour être vu et entendu.");
    });
    return () => {
      cancelled = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocal(null);
    };
  }, [role, attachLocal]);

  const setTrack = useCallback((kind: "cam" | "mic", on: boolean) => {
    const tracks = kind === "cam" ? localRef.current?.getVideoTracks() : localRef.current?.getAudioTracks();
    tracks?.forEach((t) => { t.enabled = on; });
    mediaState.current[kind] = on;
    (kind === "cam" ? setCam : setMic)(on);
    send(channelRef.current, "media", { from: sessionRef.current, ...mediaState.current });
  }, []);

  const toggleCam = useCallback(() => setTrack("cam", !mediaState.current.cam), [setTrack]);
  const toggleMic = useCallback(() => setTrack("mic", !mediaState.current.mic), [setTrack]);
  const muteAll = useCallback(() => send(channelRef.current, "muteAll", { from: id }), [id]);

  return { local, peers, cam, mic, error, toggleCam, toggleMic, muteAll };
}

"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";

// Nombre de vignettes dont le son attend un clic, pour afficher un seul
// bandeau « Activer le son » sur toute la page.
let blockedTiles = 0;
const blockedListeners = new Set<() => void>();
function changeBlocked(delta: number) {
  blockedTiles += delta;
  blockedListeners.forEach((l) => l());
}
function subscribeBlocked(listener: () => void) {
  blockedListeners.add(listener);
  return () => { blockedListeners.delete(listener); };
}

/**
 * Vignette d'un participant de l'appel vidéo. La sienne est muette et en
 * miroir, comme dans une glace. Si le navigateur refuse de lancer le son
 * tout seul, la vidéo démarre muette et le son revient au premier clic.
 */
export function VideoTile({
  stream, name, cam, mic, self = false, className = "",
}: {
  stream: MediaStream | null;
  name: string;
  cam: boolean;
  mic: boolean;
  self?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = self;
    if (!stream) return;
    video.play().catch(() => {
      video.muted = true;
      setBlocked(true);
      video.play().catch(() => {});
    });
  }, [stream, self]);

  useEffect(() => {
    if (!blocked) return;
    changeBlocked(1);
    const unblock = () => {
      const video = ref.current;
      if (!video) return;
      video.muted = false;
      video.play().then(() => setBlocked(false)).catch(() => {});
    };
    document.addEventListener("pointerdown", unblock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unblock);
      changeBlocked(-1);
    };
  }, [blocked]);

  const showVideo = !!stream && cam && stream.getVideoTracks().length > 0;

  return (
    <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md border-[3px] border-[#FFFDF8] bg-[#6B705C] ${className}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${showVideo ? "" : "invisible"}`}
        style={self ? { transform: "scaleX(-1)" } : undefined}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-[45%] aspect-square rounded-full bg-[#FFFDF8]/20 flex items-center justify-center text-[#FFFDF8] font-black text-[clamp(1rem,4vmin,2.5rem)]">
            {name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </div>
      )}
      <div className="absolute left-1.5 bottom-1.5 right-1.5 flex items-center gap-1">
        <span className="max-w-full truncate px-2 py-0.5 rounded-full bg-black/45 text-white text-xs font-bold">
          {self ? `${name} (moi)` : name}
        </span>
        {!mic && <span className="p-1 rounded-full bg-[#BB908E] text-white"><MicOff size={11} /></span>}
        {blocked && <span className="p-1 rounded-full bg-black/45 text-white" title="Touchez l'écran pour le son"><VolumeX size={11} /></span>}
      </div>
    </div>
  );
}

/**
 * Bandeau bien visible tant que le navigateur bloque le son d'au moins un
 * participant : n'importe quel clic le rétablit, ce bouton le dit clairement.
 */
export function SoundUnlock() {
  const blocked = useSyncExternalStore(subscribeBlocked, () => blockedTiles, () => 0);
  if (blocked <= 0) return null;
  return (
    <button
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-5 py-3 rounded-full bg-[#6B705C] text-white font-bold shadow-lg animate-pulse"
    >
      <Volume2 size={20} /> Activer le son
    </button>
  );
}

/** Boutons micro et caméra. */
export function CallButtons({
  cam, mic, onCam, onMic, disabled = false,
}: {
  cam: boolean;
  mic: boolean;
  onCam: () => void;
  onMic: () => void;
  disabled?: boolean;
}) {
  const base = "w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110 disabled:opacity-30 disabled:hover:scale-100";
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMic}
        disabled={disabled}
        aria-label={mic ? "Couper le micro" : "Allumer le micro"}
        title={mic ? "Couper le micro" : "Allumer le micro"}
        className={`${base} ${mic ? "bg-white border border-[#EDE5D8] text-[#2D2D2D]/70" : "bg-[#BB908E] text-white"}`}
      >
        {mic ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button
        onClick={onCam}
        disabled={disabled}
        aria-label={cam ? "Couper la caméra" : "Allumer la caméra"}
        title={cam ? "Couper la caméra" : "Allumer la caméra"}
        className={`${base} ${cam ? "bg-white border border-[#EDE5D8] text-[#2D2D2D]/70" : "bg-[#BB908E] text-white"}`}
      >
        {cam ? <Video size={18} /> : <VideoOff size={18} />}
      </button>
    </div>
  );
}

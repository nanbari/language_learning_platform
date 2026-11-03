"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";

const STROKE = 1.75;

// Nombre de vignettes dont le son attend un clic, pour afficher un seul
// bouton « Activer le son » sur toute la page.
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

/** Les trois pastels de la charte, attribués à un participant d'après son nom : toujours la même teinte pour la même personne. */
const TONES = [
  "bg-ms-slate-soft text-ms-slate-ink",
  "bg-ms-sage-soft text-ms-sage-ink",
  "bg-ms-blush-soft text-ms-blush-ink",
];

function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Vignette d'un participant de l'appel vidéo. La sienne est muette et en
 * miroir, comme dans une glace. Si le navigateur refuse de lancer le son
 * tout seul, la vidéo démarre muette et le son revient au premier clic.
 *
 * Sans image, la vignette dit pourquoi, d'après ce que l'appel sait
 * réellement : connexion en cours, caméra coupée, ou caméra inaccessible
 * (`unavailable`, quand le navigateur a refusé l'accès).
 */
export function VideoTile({
  stream, name, cam, mic, self = false, unavailable = false, compact = false, className = "",
}: {
  stream: MediaStream | null;
  name: string;
  cam: boolean;
  mic: boolean;
  self?: boolean;
  /** Caméra et micro refusés ou absents (vignette personnelle seulement). */
  unavailable?: boolean;
  /** Vignette réduite : initiales et libellé plus petits. */
  compact?: boolean;
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

  const hasVideoTrack = !!stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideoTrack && cam;
  // Ce que la vignette sait de l'image absente, du plus bloquant au plus courant.
  const placeholder = unavailable
    ? "Caméra inaccessible"
    : !stream || !hasVideoTrack
      ? "Connexion…"
      : "Caméra coupée";
  const micOn = mic && !unavailable && !!stream;
  const label = self ? `${name} (moi)` : name;

  return (
    <figure className={`m-0 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ms-line bg-ms-surface ${className}`}>
      <div className="relative aspect-[4/3] w-full bg-ms-surface-muted">
        <video
          ref={ref}
          autoPlay
          playsInline
          aria-hidden={!showVideo}
          className={`h-full w-full object-cover ${showVideo ? "" : "invisible"}`}
          style={self ? { transform: "scaleX(-1)" } : undefined}
        />
        {!showVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
            <span
              aria-hidden="true"
              className={`flex aspect-square w-[42%] max-w-20 items-center justify-center rounded-[32%] font-bold ${toneFor(name)} ${
                compact ? "text-base" : "text-[clamp(1rem,2.4vw,1.75rem)]"
              }`}
            >
              {initials(name)}
            </span>
            <span className={`font-medium text-ms-muted ${compact ? "text-xs" : "text-[0.8125rem] leading-[1.125rem]"}`}>{placeholder}</span>
          </div>
        )}
      </div>
      <figcaption className={`flex min-w-0 items-center gap-1.5 px-2 ${compact ? "py-1 text-xs" : "py-1.5 text-[0.8125rem] leading-[1.125rem]"}`}>
        <span className="min-w-0 flex-1 truncate font-semibold text-ms-ink" title={label}>{label}</span>
        {!micOn && (
          <span className="flex shrink-0 items-center text-ms-danger" title="Micro coupé">
            <MicOff size={14} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Micro coupé</span>
          </span>
        )}
        {blocked && (
          <span className="flex shrink-0 items-center text-ms-muted" title="Son en attente : touchez l'écran">
            <VolumeX size={14} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Son en attente</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * Bouton « Activer le son », affiché tant que le navigateur bloque le son
 * d'au moins un participant. N'importe quel clic le rétablit ; ce bouton le
 * dit clairement. Il se place dans la barre de commandes de la page, à un
 * endroit fixe, plutôt qu'au-dessus de l'exercice.
 */
export function SoundUnlock({ className = "" }: { className?: string }) {
  const blocked = useSyncExternalStore(subscribeBlocked, () => blockedTiles, () => 0);
  if (blocked <= 0) return null;
  return (
    <button type="button" data-variant="primary" data-accent="slate" className={`ms-button ${className}`}>
      <Volume2 size={20} strokeWidth={STROKE} aria-hidden="true" /> Activer le son
    </button>
  );
}

/**
 * Boutons micro et caméra, avec leur libellé. Tant que caméra et micro ne
 * sont pas confirmés par le navigateur (`disabled`), ils ne sont jamais
 * présentés comme allumés.
 */
export function CallButtons({
  cam, mic, onCam, onMic, disabled = false, hideLabelsOnMobile = false,
}: {
  cam: boolean;
  mic: boolean;
  onCam: () => void;
  onMic: () => void;
  disabled?: boolean;
  /** Espace élève, petit écran : icônes seules (le nom reste lu par les lecteurs d'écran). */
  hideLabelsOnMobile?: boolean;
}) {
  const micOn = mic && !disabled;
  const camOn = cam && !disabled;
  const text = hideLabelsOnMobile ? "sr-only sm:not-sr-only" : "";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMic}
        disabled={disabled}
        aria-pressed={micOn}
        title={micOn ? "Couper le micro" : "Allumer le micro"}
        data-variant={micOn ? "secondary" : "danger"}
        className="ms-button"
      >
        {micOn ? <Mic size={20} strokeWidth={STROKE} aria-hidden="true" /> : <MicOff size={20} strokeWidth={STROKE} aria-hidden="true" />}
        <span className={text}>{micOn || disabled ? "Micro" : "Micro coupé"}</span>
      </button>
      <button
        type="button"
        onClick={onCam}
        disabled={disabled}
        aria-pressed={camOn}
        title={camOn ? "Couper la caméra" : "Allumer la caméra"}
        data-variant={camOn ? "secondary" : "danger"}
        className="ms-button"
      >
        {camOn ? <Video size={20} strokeWidth={STROKE} aria-hidden="true" /> : <VideoOff size={20} strokeWidth={STROKE} aria-hidden="true" />}
        <span className={text}>{camOn || disabled ? "Caméra" : "Caméra coupée"}</span>
      </button>
    </div>
  );
}

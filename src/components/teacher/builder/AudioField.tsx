"use client";
import { useId } from "react";
import { AlertCircle, Mic, Play, Square, Trash2 } from "lucide-react";
import { ICON_STROKE } from "@/components/platform/ui";

export type AudioFieldState = "idle" | "requesting" | "recording" | "recorded";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Un son enregistré avec la voix de l'enseignant (consigne, diapo, réponse).
 * États explicites : rien d'enregistré, autorisation du micro demandée,
 * enregistrement en cours avec sa durée, son prêt à écouter. Le son reste
 * dans la leçon ouverte et part au serveur avec « Enregistrer ».
 */
export function AudioField({ label, hint, state, elapsed, audioUrl, durationMs, busy, error, onRecord, onStop, onDelete }: {
  label: string;
  hint?: string;
  state: AudioFieldState;
  elapsed: number;
  audioUrl?: string;
  durationMs?: number;
  /** Un autre enregistrement est en cours : on n'en démarre pas un second. */
  busy: boolean;
  error?: string | null;
  onRecord: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const id = useId();
  const statusText =
    state === "requesting" ? "Autorisation du micro…"
    : state === "recording" ? `Enregistrement · ${fmt(elapsed)}`
    : state === "recorded" ? `Son prêt${durationMs ? ` · ${(durationMs / 1000).toFixed(1).replace(".", ",")} s` : ""}`
    : "Aucun audio enregistré";

  return (
    <div role="group" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined}
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition-colors duration-[140ms] ${
        state === "recording" ? "border-ms-danger bg-ms-danger-soft"
        : state === "recorded" ? "border-ms-line bg-ms-sage-soft"
        : "border-dashed border-ms-control bg-ms-surface"
      }`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          state === "recording" ? "bg-ms-surface text-ms-danger" : state === "recorded" ? "bg-ms-surface text-ms-sage-ink" : "bg-ms-surface-muted text-ms-muted"
        }`}>
          <Mic size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p id={`${id}-l`} className="text-sm font-semibold leading-5">{label}</p>
          <p className={`text-sm leading-5 tabular-nums ${state === "recording" ? "text-ms-danger font-semibold" : "text-ms-muted"}`} aria-live="polite">
            {state === "recording" && <span aria-hidden="true" className="me-1.5 inline-block h-2 w-2 rounded-full bg-ms-danger align-middle" />}
            {statusText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state === "recording" ? (
            <button type="button" onClick={onStop} data-variant="danger" className="ms-button">
              <Square size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> Arrêter
            </button>
          ) : state === "recorded" && audioUrl ? (
            <>
              <button type="button" onClick={() => void new Audio(audioUrl).play()} data-variant="secondary" className="ms-button">
                <Play size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> Écouter
              </button>
              <button type="button" onClick={onRecord} disabled={busy} data-variant="quiet" className="ms-button !px-3">
                Remplacer<span className="hidden sm:inline"> l&apos;audio</span>
              </button>
              <button type="button" onClick={onDelete} data-variant="quiet" className="ms-button !px-2.5" aria-label={`Supprimer : ${label}`}>
                <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button type="button" onClick={onRecord} disabled={busy || state === "requesting"} data-variant="secondary" className="ms-button">
              <Mic size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> Enregistrer le son
            </button>
          )}
        </div>
      </div>
      {hint && <p id={`${id}-h`} className="text-sm leading-5 text-ms-muted">{hint}</p>}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm leading-5 text-ms-danger">
          <AlertCircle size={18} strokeWidth={ICON_STROKE} className="mt-px shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

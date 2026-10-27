"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown, CircleCheck, LoaderCircle, Mic, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { Button, ICON_STROKE, InlineNotice } from "@/components/platform/ui";

/**
 * États explicites d'un enregistreur. « saved » n'est affiché qu'après la
 * confirmation de la sauvegarde (serveur ou navigateur selon la page).
 */
export type RecorderPhase = "idle" | "requesting" | "recording" | "uploading" | "saved" | "error";

const MIC_DENIED = "Autorisez le microphone dans votre navigateur pour enregistrer.";

/** Message d'erreur d'accès au micro : refus explicite, ou autre échec. */
export function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  return name === "NotAllowedError" || name === "SecurityError"
    ? MIC_DENIED
    : "Impossible d'accéder au microphone. Vérifiez qu'un micro est branché et que le navigateur y a accès.";
}

const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Statut d'enregistrement d'une ligne : toujours un libellé texte. */
function RecordingPill({ hasAudio }: { hasAudio: boolean }) {
  return hasAudio ? (
    <span className="ms-status whitespace-nowrap" style={{ background: "var(--ms-sage-soft)", color: "var(--ms-sage-ink)" }}>
      <CircleCheck size={14} strokeWidth={2} aria-hidden="true" /> Enregistré
    </span>
  ) : (
    <span className="ms-status whitespace-nowrap" data-state="outline">Aucun audio enregistré</span>
  );
}

/**
 * Une entrée de la bibliothèque audio : ligne compacte (contenu, statut,
 * écoute rapide) et, une fois dépliée, l'enregistreur. Composant de
 * présentation : la capture et la sauvegarde restent dans la page.
 */
export default function AudioRecorderRow({
  id, name, leading, title, subtitle, hasAudio, phase, elapsed, error, expanded, onToggle,
  locked, canRecord = true, onRecord, onStop, onPlay, onDelete, deleteHint,
}: {
  /** Base des identifiants DOM de la ligne. */
  id: string;
  /** Nom court lu par les lecteurs d'écran dans les libellés des boutons. */
  name: string;
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  hasAudio: boolean;
  phase: RecorderPhase;
  elapsed: number;
  error?: string | null;
  expanded: boolean;
  onToggle: () => void;
  /** Un autre enregistrement est en cours : on ne lance rien ici. */
  locked: boolean;
  canRecord?: boolean;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onDelete: () => Promise<void> | void;
  /** Conséquence de la suppression, affichée dans la confirmation. */
  deleteHint: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const panelId = `${id}-rec`;
  const active = phase === "requesting" || phase === "recording" || phase === "uploading";
  // Une ligne en cours d'enregistrement reste dépliée : « Arrêter » doit rester accessible.
  const open = expanded || active;
  const disabled = locked || !canRecord;

  const confirmDelete = async () => {
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); setConfirming(false); }
  };

  return (
    <li data-recording={phase === "recording" ? "" : undefined} className="data-[recording]:bg-ms-blush-soft">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => { if (!active) onToggle(); }}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left"
        >
          <ChevronDown
            size={18} strokeWidth={ICON_STROKE} aria-hidden="true"
            className={`flex-shrink-0 text-ms-muted transition-transform duration-[180ms] ${open ? "" : "-rotate-90"}`}
          />
          {leading}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
              <RecordingPill hasAudio={hasAudio} />
            </span>
            {subtitle && <span className="text-sm text-ms-muted [overflow-wrap:anywhere]">{subtitle}</span>}
          </span>
        </button>
        {hasAudio && !active && (
          <Button variant="quiet" onClick={onPlay} aria-label={`Écouter « ${name} »`} title="Écouter" className="flex-shrink-0">
            <Play size={18} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </Button>
        )}
      </div>

      {open && (
        <div id={panelId} className="px-3 pb-4 sm:px-4">
          <div className="space-y-3 rounded-xl bg-ms-surface-muted p-4 data-[recording]:bg-ms-surface" data-recording={phase === "recording" ? "" : undefined}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <p aria-live="polite" className="flex items-center gap-2 font-semibold">
                {phase === "requesting" && <><LoaderCircle size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="animate-spin" data-ms-motion="" /> Autorisation du microphone…</>}
                {phase === "recording" && <><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ms-danger" /> Enregistrement en cours</>}
                {phase === "uploading" && <><LoaderCircle size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="animate-spin" data-ms-motion="" /> Sauvegarde de l&apos;enregistrement…</>}
                {phase === "saved" && <span className="flex items-center gap-2 text-ms-sage-ink"><CircleCheck size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Enregistrement sauvegardé.</span>}
                {(phase === "idle" || phase === "error") && (
                  <span className="font-normal text-ms-muted">
                    {hasAudio ? "Un enregistrement existe. Écoutez-le, ou remplacez-le." : "Aucun audio enregistré pour l'instant."}
                  </span>
                )}
              </p>
              {phase === "recording" && (
                <span className="font-semibold tabular-nums text-ms-danger" aria-label={`Durée ${formatElapsed(elapsed)}`}>
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>

            {phase === "error" && error && (
              <InlineNotice tone="error">
                {error}
                {hasAudio && <> L&apos;enregistrement précédent est conservé.</>}
              </InlineNotice>
            )}

            {confirming ? (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Supprimer l'enregistrement « ${name} »`}>
                <p className="w-full text-sm"><span className="font-semibold">Supprimer cet enregistrement ?</span> {deleteHint}</p>
                <Button variant="danger" disabled={deleting} onClick={confirmDelete}>
                  {deleting ? "Suppression…" : "Supprimer"}
                </Button>
                <Button variant="secondary" disabled={deleting} onClick={() => setConfirming(false)}>Annuler</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {phase === "recording" ? (
                  <Button variant="primary" onClick={onStop}>
                    <Square size={16} strokeWidth={ICON_STROKE} fill="currentColor" aria-hidden="true" /> Arrêter
                  </Button>
                ) : (
                  <Button
                    variant={hasAudio ? "secondary" : "primary"}
                    onClick={onRecord}
                    disabled={disabled || active}
                  >
                    {hasAudio
                      ? <><RotateCcw size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Remplacer l&apos;audio</>
                      : <><Mic size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Enregistrer le son</>}
                  </Button>
                )}
                {hasAudio && !active && (
                  <>
                    <Button variant="secondary" onClick={onPlay}>
                      <Play size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Écouter
                    </Button>
                    <Button variant="quiet" className="text-ms-danger" disabled={locked} onClick={() => setConfirming(true)}>
                      <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Supprimer
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

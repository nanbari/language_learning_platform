"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ICON_STROKE } from "@/components/platform/ui";
import type { ContentBlock } from "@/components/teacher/builder/model";

/** Message envoyé à l'aperçu (voir teacher/create/apercu). */
export interface PreviewMessage {
  type: "ms-lesson-preview";
  title: string;
  blocks: ContentBlock[];
  startIndex: number;
}

export const PREVIEW_READY = "ms-lesson-preview-ready";

/**
 * « Voir comme un élève » : la leçon en cours d'édition jouée par le vrai
 * lecteur de l'élève, dans un cadre à part (sa largeur est celle d'un écran
 * d'élève, ses styles et ses sons restent isolés). Rien n'y est enregistré.
 * Chaque modification relance l'activité affichée.
 */
export function StudentPreview({ title, blocks, startIndex, label = "Aperçu élève", className = "" }: {
  title: string;
  blocks: ContentBlock[];
  startIndex: number;
  label?: string;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string })?.type === PREVIEW_READY) setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Un court délai : pendant la frappe, l'aperçu ne se relance pas à chaque lettre.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const message: PreviewMessage = { type: "ms-lesson-preview", title, blocks, startIndex };
      frame.current?.contentWindow?.postMessage(message, window.location.origin);
    }, 250);
    return () => clearTimeout(timer);
  }, [ready, title, blocks, startIndex, replay]);

  return (
    <section aria-label={label} className={`flex min-h-0 flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-5">{label}</h2>
          <p className="text-sm leading-5 text-ms-muted">Rien n&apos;est enregistré ici.</p>
        </div>
        <button type="button" onClick={() => setReplay((r) => r + 1)} data-variant="quiet" className="ms-button shrink-0">
          <RotateCcw size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Rejouer
        </button>
      </div>
      {/* Un outil, pas un appareil : surface calme et filet fin autour du rendu élève. */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-ms-line bg-ms-canvas">
        {!ready && <div className="ms-skeleton absolute inset-0 rounded-none" aria-hidden="true" />}
        <iframe ref={frame} src="/teacher/create/apercu" title={`${label} : la leçon telle que l'élève la verra`}
          className="h-full w-full bg-ms-canvas" />
      </div>
    </section>
  );
}

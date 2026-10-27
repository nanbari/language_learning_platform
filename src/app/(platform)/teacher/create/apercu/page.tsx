"use client";
import { useEffect, useState } from "react";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { accentAt } from "@/components/student/accents";
import { PREVIEW_READY, type PreviewMessage } from "@/components/teacher/builder/StudentPreview";

/**
 * Aperçu élève de l'éditeur de leçons, affiché dans un cadre par la page
 * d'édition : la leçon arrive par message (non enregistrée, avec ses images
 * et sons encore locaux) et se joue avec le lecteur de l'élève en mode
 * aperçu — aucun essai envoyé, aucune révision, aucun lien vers l'extérieur.
 */
export default function LessonPreviewFrame() {
  const [state, setState] = useState<{ message: PreviewMessage; rev: number } | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const data = e.data as PreviewMessage;
      if (data?.type !== "ms-lesson-preview") return;
      setState((prev) => ({ message: data, rev: (prev?.rev ?? 0) + 1 }));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!state) {
    return <div data-ms-app="" data-ms-area="student" className="min-h-dvh bg-ms-canvas" aria-busy="true" />;
  }

  const { message, rev } = state;
  if (message.blocks.length === 0) {
    return (
      <div data-ms-app="" data-ms-area="student" className="flex min-h-dvh items-center justify-center bg-ms-canvas px-6 text-center">
        <p className="max-w-[24ch] text-xl font-bold text-ms-muted">Ajoutez une activité pour la voir comme un élève.</p>
      </div>
    );
  }

  return (
    <LessonPlayer
      key={rev}
      lesson={{ id: "apercu", title: message.title, blocks: message.blocks as never }}
      accent={accentAt(0)}
      home="/teacher" homeLabel="" backLabel=""
      preview
      startIndex={message.startIndex}
    />
  );
}

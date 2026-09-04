/**
 * Accès client aux événements d'exercice via /api/events.
 *
 * L'envoi est « fire and forget » : une erreur réseau ne doit jamais
 * interrompre la leçon. Les événements sont regroupés brièvement puis
 * envoyés en lot avec `keepalive` pour survivre à un changement de page.
 */
import type { ExerciseEventInput, ExerciseEventRow } from "./exerciseEvents";
import { MAX_BATCH } from "./exerciseEvents";

const FLUSH_DELAY_MS = 300;

const queue: ExerciseEventInput[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersInstalled = false;

function flush(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: batch }),
    keepalive: true,
  }).catch(() => { /* perte silencieuse : ne jamais bloquer l'élève */ });
  if (queue.length > 0) flush();
}

function installListeners(): void {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  // pagehide couvre la fermeture d'onglet et la navigation ; visibilitychange
  // couvre le passage en arrière-plan sur mobile.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** Met un événement en file ; l'envoi est différé et groupé. */
export function logExerciseEvent(event: ExerciseEventInput): void {
  if (typeof window === "undefined") return;
  installListeners();
  queue.push(event);
  if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Force l'envoi immédiat de la file (utile avant de quitter une leçon). */
export function flushExerciseEvents(): void {
  flush();
}

export interface FetchEventsParams {
  lessonId?: string;
  userId?: string;
  blockId?: string;
  limit?: number;
}

/** Lit les événements (élève : les siens ; enseignant / admin : tous). */
export async function fetchExerciseEvents(params: FetchEventsParams = {}): Promise<ExerciseEventRow[]> {
  const qs = new URLSearchParams();
  if (params.lessonId) qs.set("lessonId", params.lessonId);
  if (params.userId)   qs.set("userId", params.userId);
  if (params.blockId)  qs.set("blockId", params.blockId);
  if (params.limit)    qs.set("limit", String(params.limit));
  const res = await fetch(`/api/events${qs.size ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  return data as ExerciseEventRow[];
}

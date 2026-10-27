/**
 * Accès client aux événements d'exercice via /api/events.
 *
 * L'envoi ne bloque jamais la leçon : les événements sont regroupés
 * brièvement puis envoyés en lot avec `keepalive` pour survivre à un
 * changement de page. Un lot qui ne part pas (réseau coupé, serveur
 * indisponible) est conservé dans localStorage et renvoyé au retour en ligne
 * ou à la prochaine visite — avec son identifiant, le serveur ne l'enregistre
 * pas deux fois (lib/eventQueue).
 */
import type { ExerciseEventInput, ExerciseEventRow } from "@/lib/exerciseEvents";
import { MAX_BATCH } from "@/lib/exerciseEvents";
import { EventQueue } from "@/lib/eventQueue";
import { apiFetch } from "@/lib/api/client";

const FLUSH_DELAY_MS = 300;
const STORAGE_KEY = "ms-events-queue";

let queue: EventQueue | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function storage() {
  try {
    const ls = window.localStorage;
    return { read: () => ls.getItem(STORAGE_KEY), write: (v: string) => ls.setItem(STORAGE_KEY, v) };
  } catch {
    return null;
  }
}

/** Un lot est « parti » si le serveur l'a accepté ; un refus définitif (4xx) ne se rejoue pas. */
async function send(batch: ExerciseEventInput[]): Promise<boolean> {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: batch }),
    keepalive: true,
  });
  if (res.ok) return true;
  if (res.status >= 400 && res.status < 500) return true; // lot invalide ou session close : inutile d'insister
  return false;
}

function getQueue(): EventQueue {
  if (queue) return queue;
  queue = new EventQueue({ storage: storage(), send, maxBatch: MAX_BATCH, newId: () => crypto.randomUUID() });
  // pagehide couvre la fermeture d'onglet et la navigation ; visibilitychange
  // le passage en arrière-plan sur mobile ; online le retour du réseau.
  const flush = () => { void getQueue().flush(); };
  window.addEventListener("pagehide", flush);
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  if (queue.pendingCount > 0) flush();
  return queue;
}

/** Met un événement en file ; l'envoi est différé et groupé. */
export function logExerciseEvent(event: ExerciseEventInput): void {
  if (typeof window === "undefined") return;
  getQueue().push(event);
  if (!timer) timer = setTimeout(() => { timer = null; void getQueue().flush(); }, FLUSH_DELAY_MS);
}

/**
 * Force l'envoi immédiat de la file et attend que tous les envois soient
 * terminés (utile avant de quitter une leçon ou de relire les événements).
 */
export async function flushExerciseEvents(): Promise<void> {
  if (typeof window === "undefined") return;
  if (timer) { clearTimeout(timer); timer = null; }
  await getQueue().flush();
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
  return apiFetch<ExerciseEventRow[]>(`/api/events${qs.size ? `?${qs}` : ""}`);
}

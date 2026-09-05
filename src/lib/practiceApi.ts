/**
 * Accès client aux séries de révision via /api/practice.
 */
import type { PracticeSet } from "./practice";
import type { LessonReviewSummary } from "./weakSpots";

export type GenerateResult =
  | { status: "created"; set: PracticeSet }
  | { status: "nothing_to_review" }
  | { status: "empty" };

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  }
  return data as T;
}

/** Dernière série de révision de l'élève pour une leçon (null si aucune). */
export async function fetchLatestPracticeSet(lessonId: string): Promise<PracticeSet | null> {
  return jsonOrThrow<PracticeSet | null>(await fetch(`/api/practice?lessonId=${encodeURIComponent(lessonId)}`));
}

/** Demande à l'agent une nouvelle série ciblée sur les exercices ratés. */
export async function generatePractice(lessonId: string): Promise<GenerateResult> {
  return jsonOrThrow<GenerateResult>(await fetch("/api/practice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId }),
  }));
}

/** Leçons où l'élève a des exercices à revoir (vide si rien à revoir). */
export async function fetchPracticeSummary(userId?: string): Promise<LessonReviewSummary[]> {
  const url = userId ? `/api/practice/summary?userId=${encodeURIComponent(userId)}` : "/api/practice/summary";
  return jsonOrThrow<LessonReviewSummary[]>(await fetch(url));
}

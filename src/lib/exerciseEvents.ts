/**
 * Événements d'exercice — modèle partagé client / serveur.
 *
 * Chaque interaction d'un élève avec un exercice produit un événement
 * horodaté stocké dans la table `exercise_events`. C'est la matière
 * première des futurs agents adaptatifs (tuteur, recommandation, niveau).
 *
 * Types d'événements :
 *  - attempt  : une réponse soumise (correcte ou non), avec la réponse choisie
 *  - complete : l'exercice est réussi ; attempt_number = nombre total d'essais
 *  - hint     : un indice a été affiché (réservé au futur agent tuteur)
 *  - view     : l'exercice a été affiché puis passé sans réponse possible
 *               (rendus non interactifs : appariement, tri)
 */

export const EXERCISE_TYPES = ["quiz", "matching", "dragdrop", "wordorder", "image-quiz"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const EVENT_TYPES = ["attempt", "complete", "hint", "view"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface ExerciseEventInput {
  lesson_id: string;
  block_id: string;
  exercise_type: ExerciseType;
  event_type: EventType;
  /** Réponse correcte ? Null quand la notion n'a pas de sens (view, hint). */
  correct?: boolean | null;
  /** Réponse choisie, forme libre selon le type d'exercice. */
  answer?: Record<string, unknown> | null;
  /** Numéro de l'essai (1 = premier essai). */
  attempt_number?: number | null;
  /** Nombre d'indices vus jusqu'ici. */
  hint_count?: number;
  /** Temps écoulé depuis l'affichage de l'exercice, en millisecondes. */
  time_ms?: number | null;
}

export interface ExerciseEventRow extends Required<Omit<ExerciseEventInput, "hint_count">> {
  id: string;
  user_id: string;
  hint_count: number;
  created_at: string;
}

/** Taille maximale du JSON `answer`, pour éviter qu'un client ne stocke n'importe quoi. */
export const MAX_ANSWER_BYTES = 2048;
/** Durée maximale plausible sur un exercice (6 h) ; au-delà, la valeur est écrêtée. */
export const MAX_TIME_MS = 6 * 60 * 60 * 1000;
/** Nombre maximal d'événements acceptés par requête. */
export const MAX_BATCH = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ParseResult = { ok: true; value: ExerciseEventInput } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function optionalNonNegInt(v: unknown, name: string, max: number): number | null | { error: string } {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return { error: `${name} doit être un entier positif` };
  return Math.min(Math.round(v), max);
}

/** Valide et normalise un événement venu du client. */
export function parseExerciseEvent(input: unknown): ParseResult {
  if (!isPlainObject(input)) return { ok: false, error: "événement invalide" };

  const { lesson_id, block_id, exercise_type, event_type, correct, answer, attempt_number, hint_count, time_ms } = input;

  if (typeof lesson_id !== "string" || !UUID_RE.test(lesson_id)) return { ok: false, error: "lesson_id invalide" };
  if (typeof block_id !== "string" || block_id.length === 0 || block_id.length > 64) return { ok: false, error: "block_id invalide" };
  if (!EXERCISE_TYPES.includes(exercise_type as ExerciseType)) return { ok: false, error: "exercise_type invalide" };
  if (!EVENT_TYPES.includes(event_type as EventType)) return { ok: false, error: "event_type invalide" };

  if (correct !== undefined && correct !== null && typeof correct !== "boolean") {
    return { ok: false, error: "correct doit être un booléen" };
  }

  if (answer !== undefined && answer !== null) {
    if (!isPlainObject(answer)) return { ok: false, error: "answer doit être un objet" };
    if (JSON.stringify(answer).length > MAX_ANSWER_BYTES) return { ok: false, error: "answer trop volumineux" };
  }

  const attempt = optionalNonNegInt(attempt_number, "attempt_number", 10_000);
  if (typeof attempt === "object" && attempt !== null) return { ok: false, error: attempt.error };
  if (attempt === 0) return { ok: false, error: "attempt_number commence à 1" };

  const hints = optionalNonNegInt(hint_count, "hint_count", 1_000);
  if (typeof hints === "object" && hints !== null) return { ok: false, error: hints.error };

  const time = optionalNonNegInt(time_ms, "time_ms", MAX_TIME_MS);
  if (typeof time === "object" && time !== null) return { ok: false, error: time.error };

  return {
    ok: true,
    value: {
      lesson_id,
      block_id,
      exercise_type: exercise_type as ExerciseType,
      event_type: event_type as EventType,
      correct: correct ?? null,
      answer: (answer as Record<string, unknown> | undefined) ?? null,
      attempt_number: attempt,
      hint_count: hints ?? 0,
      time_ms: time,
    },
  };
}

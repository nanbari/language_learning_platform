/**
 * Analyse des points faibles d'un élève à partir du journal `exercise_events`.
 *
 * Module pur (aucun accès réseau) : il reçoit les blocs d'une leçon et les
 * événements de l'élève sur cette leçon, et rend la liste des exercices mal
 * réussis, triés du plus fragile au moins fragile. C'est l'entrée de l'agent
 * de génération d'exercices de révision (voir practiceGenerator).
 *
 * Seule la dernière « passe » sur chaque exercice compte : les passes sont
 * séparées par les événements `complete`. Un exercice raté il y a un mois
 * puis réussi du premier coup hier n'est donc plus considéré comme faible.
 */
import type { ContentBlock, Exercise, QuizExercise, WordOrderExercise } from "@/components/lesson/ExerciseRenderers";
import { describeLetterAnswer, isLettersBlock, letterGames, type LetterGameExercise, type LettersBlock } from "./letterExercises";
import type { ExerciseEventRow } from "./exerciseEvents";

/** Exercices dont on sait produire une variante textuelle. */
export type ReviewableExercise = QuizExercise | WordOrderExercise;
/** Exercices suivis pour la révision : ceux à variante textuelle, et les jeux du bloc « Lettres ». */
export type SpotExercise = ReviewableExercise | LetterGameExercise;
/** Blocs d'une leçon tels qu'enregistrés (le bloc « Lettres » s'ajoute aux blocs de contenu). */
export type LessonBlock = ContentBlock | LettersBlock;

export interface WeakSpot {
  /** Id du bloc, ou id stable du jeu de lettres (voir letterGameId). */
  blockId: string;
  exercise: SpotExercise;
  /** Essais lors de la dernière passe. */
  attempts: number;
  /** Essais faux lors de la dernière passe. */
  wrongAttempts: number;
  /** L'exercice a-t-il été réussi lors de la dernière passe ? */
  completed: boolean;
  /** Indices vus lors de la dernière passe. */
  hints: number;
  /** Essais faux sur tout l'historique (toutes passes confondues). */
  totalWrongAttempts: number;
  /** Réponses fausses lisibles, les plus récentes d'abord, sans doublon. */
  wrongAnswers: string[];
  lastSeenAt: string;
  /** Indice de fragilité : plus il est élevé, plus l'exercice est à revoir. */
  score: number;
}

const MAX_WRONG_ANSWERS = 5;

function isReviewable(ex: Exercise): ex is ReviewableExercise {
  return ex.type === "quiz" || ex.type === "wordorder";
}

/** Point faible dont l'agent sait produire une variante (hors jeux de lettres). */
export type TextWeakSpot = WeakSpot & { exercise: ReviewableExercise };
export function isTextSpot(spot: WeakSpot): spot is TextWeakSpot {
  return spot.exercise.type !== "letterGame";
}

/** Exercices révisables d'une leçon, avec l'id sous lequel leurs événements sont journalisés. */
function reviewableExercises(blocks: LessonBlock[]): { id: string; exercise: SpotExercise }[] {
  const out: { id: string; exercise: SpotExercise }[] = [];
  for (const block of blocks) {
    if (isLettersBlock(block)) out.push(...letterGames(block));
    else if (block.type === "exercise" && isReviewable(block.exercise)) out.push({ id: block.id, exercise: block.exercise });
  }
  return out;
}

/** Rend la réponse d'un événement sous forme lisible (texte de l'option, phrase…). */
export function describeAnswer(exercise: SpotExercise, answer: unknown): string | null {
  if (!answer || typeof answer !== "object") return null;
  const a = answer as Record<string, unknown>;
  if (exercise.type === "letterGame") {
    return typeof a.choiceId === "string" ? describeLetterAnswer(exercise.slide, a.choiceId) : null;
  }
  if (exercise.type === "quiz" && typeof a.optionId === "string") {
    const opt = exercise.options.find((o) => o.id === a.optionId);
    return opt?.text?.trim() || null;
  }
  if (exercise.type === "wordorder" && Array.isArray(a.words)) {
    const words = a.words.filter((w): w is string => typeof w === "string");
    return words.length ? words.join(" ") : null;
  }
  return null;
}

/**
 * Ordre chronologique des événements. Ceux d'un même envoi (réponse puis
 * réussite) ont exactement le même `created_at` en base : à égalité, la
 * réussite passe après les réponses, et les réponses suivent leur numéro.
 * Sans cela, une réussite du premier coup pouvait être lue « tentée mais
 * pas terminée ». Partagé avec l'analyse enseignant (teacherInsights).
 */
export function compareEvents(a: ExerciseEventRow, b: ExerciseEventRow): number {
  return a.created_at.localeCompare(b.created_at)
    || Number(a.event_type === "complete") - Number(b.event_type === "complete")
    || (a.attempt_number ?? 0) - (b.attempt_number ?? 0);
}

/**
 * Rend la dernière passe d'un exercice : les événements (ordre chronologique)
 * sont découpés en passes séparées par `complete`. Partagé avec l'analyse
 * enseignant (teacherInsights).
 */
export function lastRun(events: ExerciseEventRow[]): ExerciseEventRow[] {
  const runs: ExerciseEventRow[][] = [[]];
  for (const e of events) {
    runs[runs.length - 1].push(e);
    if (e.event_type === "complete") runs.push([]);
  }
  const last = runs[runs.length - 1];
  return last.length > 0 ? last : runs[runs.length - 2] ?? [];
}

/**
 * Calcule les points faibles. `events` peut être dans n'importe quel ordre
 * et contenir d'autres leçons : seuls les blocs de `blocks` sont examinés.
 */
export function analyseWeakSpots(blocks: LessonBlock[], events: ExerciseEventRow[]): WeakSpot[] {
  const byBlock = new Map<string, ExerciseEventRow[]>();
  for (const e of events) {
    const list = byBlock.get(e.block_id);
    if (list) list.push(e); else byBlock.set(e.block_id, [e]);
  }

  const spots: WeakSpot[] = [];
  for (const block of reviewableExercises(blocks)) {
    const all = byBlock.get(block.id);
    if (!all || all.length === 0) continue;

    all.sort(compareEvents);
    const run = lastRun(all);

    const attemptsInRun = run.filter((e) => e.event_type === "attempt");
    const attempts      = attemptsInRun.length;
    const wrongAttempts = attemptsInRun.filter((e) => e.correct === false).length;
    const completed     = run.some((e) => e.event_type === "complete");
    const hints         = run.filter((e) => e.event_type === "hint").length;
    const totalWrong    = all.filter((e) => e.event_type === "attempt" && e.correct === false).length;

    if (attempts === 0) continue;                                // seulement affiché
    if (wrongAttempts === 0 && completed && hints === 0) continue; // réussi du premier coup

    const wrongAnswers: string[] = [];
    for (const e of [...all].reverse()) {
      if (e.event_type !== "attempt" || e.correct !== false) continue;
      const text = describeAnswer(block.exercise, e.answer);
      if (text && !wrongAnswers.includes(text)) wrongAnswers.push(text);
      if (wrongAnswers.length >= MAX_WRONG_ANSWERS) break;
    }

    const score =
      wrongAttempts / attempts +
      (completed ? 0 : 0.5) +
      Math.min(hints, 3) * 0.1 +
      Math.min(totalWrong, 10) * 0.02;

    spots.push({
      blockId: block.id,
      exercise: block.exercise,
      attempts, wrongAttempts, completed, hints,
      totalWrongAttempts: totalWrong,
      wrongAnswers,
      lastSeenAt: all[all.length - 1].created_at,
      score,
    });
  }

  spots.sort((a, b) => b.score - a.score || b.lastSeenAt.localeCompare(a.lastSeenAt));
  return spots;
}

/** Résumé par leçon, pour proposer les révisions sur le tableau de bord. */
export interface LessonReviewSummary {
  lessonId: string;
  /** Nombre d'exercices à revoir (ratés ou non terminés lors de la dernière passe). */
  toReview: number;
  /** Nombre d'exercices révisables de la leçon (quiz, remise en ordre, jeux de lettres). */
  reviewable: number;
  /** Date du dernier événement sur un exercice à revoir. */
  lastFailedAt: string | null;
}

/**
 * Résume les points faibles de plusieurs leçons. Seules les leçons ayant au
 * moins un exercice à revoir sont rendues, les plus récemment ratées d'abord.
 * `events` peut contenir toutes les leçons de l'élève : chaque leçon ne
 * reçoit que les siens.
 */
export function summariseWeakSpots(
  lessons: { id: string; blocks: LessonBlock[] }[],
  events: ExerciseEventRow[],
): LessonReviewSummary[] {
  const byLesson = new Map<string, ExerciseEventRow[]>();
  for (const e of events) {
    const list = byLesson.get(e.lesson_id);
    if (list) list.push(e); else byLesson.set(e.lesson_id, [e]);
  }

  const out: LessonReviewSummary[] = [];
  for (const lesson of lessons) {
    const own = byLesson.get(lesson.id);
    if (!own || own.length === 0) continue;
    const spots = analyseWeakSpots(lesson.blocks, own);
    if (spots.length === 0) continue;
    const reviewable = reviewableExercises(lesson.blocks).length;
    const lastFailedAt = spots.map((s) => s.lastSeenAt).sort().pop() ?? null;
    out.push({ lessonId: lesson.id, toReview: spots.length, reviewable, lastFailedAt });
  }

  out.sort((a, b) => (b.lastFailedAt ?? "").localeCompare(a.lastFailedAt ?? ""));
  return out;
}

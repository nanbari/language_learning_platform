/**
 * Tableau de bord enseignant : progression réelle des élèves, calculée à
 * partir du journal `exercise_events`.
 *
 * Module pur (aucun accès réseau), testé à part. Il reçoit les leçons (avec
 * leurs blocs), les élèves et leurs événements, et rend la progression
 * détaillée de chaque élève : ses leçons (réussite du premier coup,
 * progression, dernière activité) et, pour chacune, le statut de chaque
 * exercice avec les réponses erronées (texte ou image : beaucoup de quiz
 * n'ont ni question écrite ni texte d'option, seulement un audio et des images).
 *
 * Comme pour les révisions (weakSpots), seule la dernière passe d'un élève
 * sur un exercice compte pour son statut ; les erreurs de cette dernière
 * passe sont séparées de celles des passes précédentes.
 */
import type { ContentBlock, Exercise, QuizExercise } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "./exerciseEvents";
import { compareEvents, lastRun } from "./weakSpots";

export interface InsightLesson { id: string; title: string; blocks: ContentBlock[] }
export interface InsightUser   { id: string; name: string }

export interface StudentLesson {
  lessonId: string;
  lessonTitle: string;
  /** Exercices de la leçon. */
  exercisesTotal: number;
  /** Exercices affichés au moins une fois (essai ou simple vue). */
  exercisesSeen: number;
  /** Exercices où l'élève a répondu au moins une fois. */
  exercisesAttempted: number;
  /** Exercices réussis du premier coup lors de la dernière passe. */
  firstTrySuccesses: number;
  /** firstTrySuccesses / exercisesAttempted, null si aucun essai. */
  firstTryRate: number | null;
  /** Exercices à revoir (ratés ou non terminés lors de la dernière passe). */
  toReview: number;
  lastActivityAt: string;
  /** Tous les exercices de la leçon, dans l'ordre, y compris ceux jamais vus. */
  exercises: StudentExercise[];
}

/** Une réponse lisible : texte, image, ou les deux. */
export interface AnswerDescriptor {
  /** Identifiant stable pour regrouper (id d'option, phrase…). */
  key: string;
  text: string | null;
  imageUrl: string | null;
}

export interface WrongAnswerCount extends AnswerDescriptor { count: number }

/**
 * Statut d'un exercice pour un élève, d'après sa dernière passe :
 *  - first_try : réussi du premier coup, sans indice ;
 *  - after_errors : réussi après des erreurs ou un indice ;
 *  - failed : répondu sans réussir (abandonné ou en cours) ;
 *  - seen : affiché, sans réponse ;
 *  - not_started : jamais affiché.
 */
export type ExerciseStatus = "first_try" | "after_errors" | "failed" | "seen" | "not_started";

export interface StudentExercise {
  blockId: string;
  type: Exercise["type"];
  /** Rang de l'exercice dans la leçon (1 = premier exercice). */
  position: number;
  /** Question, phrase, ou « Quiz n°3 » quand l'exercice n'a pas de texte. */
  label: string;
  /** Réponse attendue (quiz, remise en ordre), pour reconnaître l'exercice. */
  correctAnswer: AnswerDescriptor | null;
  /** Consigne donnée en audio (sans question écrite). */
  hasAudio: boolean;
  status: ExerciseStatus;
  /** Réponses fausses lors de la dernière tentative (celle qui donne le statut). */
  wrongAttempts: number;
  /** Ses réponses fausses de la dernière tentative, les plus fréquentes d'abord. */
  wrongAnswers: WrongAnswerCount[];
  /** Réponses fausses des tentatives précédentes. */
  earlierWrongAttempts: number;
  earlierWrongAnswers: WrongAnswerCount[];
  lastActivityAt: string | null;
}

export interface StudentProgress {
  userId: string;
  userName: string;
  /** Leçons jouées, la plus récente d'abord. */
  lessons: StudentLesson[];
  exercisesSeen: number;
  exercisesAttempted: number;
  firstTrySuccesses: number;
  firstTryRate: number | null;
  /** Réponses fausses lors des dernières tentatives, tous exercices confondus. */
  wrongAttempts: number;
  /** Réponses fausses des tentatives précédentes. */
  earlierWrongAttempts: number;
  toReview: number;
  lastActivityAt: string;
}

export interface TeacherInsights {
  /** Un élément par élève ayant joué au moins une leçon, le plus récent d'abord. */
  students: StudentProgress[];
}

function quizOption(ex: QuizExercise, optionId: string): AnswerDescriptor | null {
  const idx = ex.options.findIndex((o) => o.id === optionId);
  if (idx < 0) return null;
  const o = ex.options[idx];
  const text = o.text?.trim() || null;
  const imageUrl = o.imageDataUrl || null;
  return { key: o.id, text: text ?? (imageUrl ? null : `Option n°${idx + 1}`), imageUrl };
}

/** Réponse attendue d'un exercice, si la notion a un sens. */
export function correctAnswerOf(ex: Exercise): AnswerDescriptor | null {
  if (ex.type === "quiz") return quizOption(ex, ex.correctId);
  if (ex.type === "wordorder") return { key: ex.sentence, text: ex.sentence, imageUrl: null };
  return null;
}

/** Rend la réponse d'un événement (texte ou image), null si illisible. */
export function describeAnswerRich(ex: Exercise, answer: unknown): AnswerDescriptor | null {
  if (!answer || typeof answer !== "object") return null;
  const a = answer as Record<string, unknown>;
  if (ex.type === "quiz" && typeof a.optionId === "string") return quizOption(ex, a.optionId);
  if (ex.type === "wordorder" && Array.isArray(a.words)) {
    const words = a.words.filter((w): w is string => typeof w === "string");
    if (words.length === 0) return null;
    const text = words.join(" ");
    return { key: text, text, imageUrl: null };
  }
  return null;
}

/** Libellé court d'un exercice ; `position` sert quand il n'a pas de texte. */
export function exerciseSummaryLabel(ex: Exercise, position?: number): string {
  const n = position ? ` n°${position}` : "";
  switch (ex.type) {
    case "quiz":      return ex.question.trim() || `Quiz${n}`;
    case "wordorder": return ex.sentence.trim() || `Remise en ordre${n}`;
    case "matching":  return `Appariement${n} (${ex.pairs.length} paires)`;
    case "dragdrop":  return `Tri${n} (${ex.items.length} éléments)`;
  }
}

function countAnswers(descriptors: AnswerDescriptor[]): WrongAnswerCount[] {
  const map = new Map<string, WrongAnswerCount>();
  for (const d of descriptors) {
    const cur = map.get(d.key);
    if (cur) cur.count += 1; else map.set(d.key, { ...d, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.text ?? "").localeCompare(b.text ?? ""));
}

const byRecent = (a: { lastActivityAt: string }, b: { lastActivityAt: string }) =>
  b.lastActivityAt.localeCompare(a.lastActivityAt);

export function buildTeacherInsights(
  lessons: InsightLesson[],
  users: InsightUser[],
  events: ExerciseEventRow[],
): TeacherInsights {
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const nameOf = (id: string) => userName.get(id) ?? "Élève";

  // user → lesson → block → événements
  const tree = new Map<string, Map<string, Map<string, ExerciseEventRow[]>>>();
  for (const e of events) {
    let byLesson = tree.get(e.user_id);
    if (!byLesson) { byLesson = new Map(); tree.set(e.user_id, byLesson); }
    let byBlock = byLesson.get(e.lesson_id);
    if (!byBlock) { byBlock = new Map(); byLesson.set(e.lesson_id, byBlock); }
    const list = byBlock.get(e.block_id);
    if (list) list.push(e); else byBlock.set(e.block_id, [e]);
  }

  const perStudent = new Map<string, StudentProgress>();

  for (const lesson of lessons) {
    const exerciseBlocks = lesson.blocks.filter(
      (b): b is Extract<ContentBlock, { type: "exercise" }> => b.type === "exercise",
    );

    for (const [userId, byLesson] of tree) {
      const byBlock = byLesson.get(lesson.id);
      if (!byBlock) continue;

      const row: StudentLesson = {
        lessonId: lesson.id, lessonTitle: lesson.title,
        exercisesTotal: exerciseBlocks.length, exercisesSeen: 0, exercisesAttempted: 0,
        firstTrySuccesses: 0, firstTryRate: null, toReview: 0, lastActivityAt: "",
        exercises: [],
      };

      exerciseBlocks.forEach((block, blockIndex) => {
        const ex = block.exercise;
        const exercise: StudentExercise = {
          blockId: block.id, type: ex.type, position: blockIndex + 1,
          label: exerciseSummaryLabel(ex, blockIndex + 1),
          correctAnswer: correctAnswerOf(ex),
          hasAudio: (ex.type === "quiz" || ex.type === "wordorder") && Boolean(ex.audioDataUrl),
          status: "not_started", wrongAttempts: 0, wrongAnswers: [],
          earlierWrongAttempts: 0, earlierWrongAnswers: [], lastActivityAt: null,
        };
        row.exercises.push(exercise);

        const all = byBlock.get(block.id);
        if (!all || all.length === 0) return;

        all.sort(compareEvents);
        const run = lastRun(all);
        const attemptsInRun = run.filter((e) => e.event_type === "attempt");
        const firstTryOk =
          attemptsInRun.length > 0 &&
          attemptsInRun[0].correct === true &&
          !run.some((e) => e.event_type === "hint");
        const completed = run.some((e) => e.event_type === "complete");
        const wrongAll = all.filter((e) => e.event_type === "attempt" && e.correct === false);
        const lastAt = all[all.length - 1].created_at;

        // Erreurs séparées : dernière tentative (cohérentes avec le statut) / tentatives précédentes.
        const inRun = new Set(run);
        const wrongRun = wrongAll.filter((e) => inRun.has(e));
        const wrongBefore = wrongAll.filter((e) => !inRun.has(e));
        const describe = (list: ExerciseEventRow[]) => countAnswers(
          list.map((e) => describeAnswerRich(ex, e.answer)).filter((d): d is AnswerDescriptor => d !== null),
        );
        exercise.lastActivityAt = lastAt;
        exercise.wrongAttempts = wrongRun.length;
        exercise.wrongAnswers = describe(wrongRun);
        exercise.earlierWrongAttempts = wrongBefore.length;
        exercise.earlierWrongAnswers = describe(wrongBefore);
        exercise.status = attemptsInRun.length === 0 ? "seen"
          : firstTryOk ? "first_try"
          : completed ? "after_errors"
          : "failed";

        row.exercisesSeen += 1;
        if (lastAt > row.lastActivityAt) row.lastActivityAt = lastAt;

        if (attemptsInRun.length === 0) return;
        row.exercisesAttempted += 1;
        if (firstTryOk) row.firstTrySuccesses += 1;
        else row.toReview += 1;
      });

      // Événements sur des blocs supprimés depuis : pas de ligne vide.
      if (row.exercisesSeen === 0) continue;
      row.firstTryRate = row.exercisesAttempted > 0 ? row.firstTrySuccesses / row.exercisesAttempted : null;

      let st = perStudent.get(userId);
      if (!st) {
        st = {
          userId, userName: nameOf(userId), lessons: [],
          exercisesSeen: 0, exercisesAttempted: 0, firstTrySuccesses: 0, firstTryRate: null,
          wrongAttempts: 0, earlierWrongAttempts: 0, toReview: 0, lastActivityAt: row.lastActivityAt,
        };
        perStudent.set(userId, st);
      }
      st.lessons.push(row);
      st.exercisesSeen += row.exercisesSeen;
      st.exercisesAttempted += row.exercisesAttempted;
      st.firstTrySuccesses += row.firstTrySuccesses;
      st.toReview += row.toReview;
      for (const ex of row.exercises) {
        st.wrongAttempts += ex.wrongAttempts;
        st.earlierWrongAttempts += ex.earlierWrongAttempts;
      }
      if (row.lastActivityAt > st.lastActivityAt) st.lastActivityAt = row.lastActivityAt;
    }
  }

  const students = [...perStudent.values()]
    .map((st) => ({
      ...st,
      lessons: st.lessons.sort(byRecent),
      firstTryRate: st.exercisesAttempted > 0 ? st.firstTrySuccesses / st.exercisesAttempted : null,
    }))
    .sort((a, b) => byRecent(a, b) || a.userName.localeCompare(b.userName));

  return { students };
}

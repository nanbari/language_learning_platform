/**
 * Tableau de bord enseignant : progression réelle des élèves et exercices
 * les moins réussis, calculés à partir du journal `exercise_events`.
 *
 * Module pur (aucun accès réseau), testé à part. Il reçoit les leçons (avec
 * leurs blocs), les élèves et leurs événements, et rend :
 *  - une ligne par couple (élève, leçon) avec réussite du premier coup,
 *    progression et dernière activité ;
 *  - le classement des exercices qui font le plus d'erreurs, avec, pour
 *    chacun, la réponse attendue, les élèves en difficulté et leurs réponses
 *    erronées (texte ou image : beaucoup de quiz n'ont ni question écrite ni
 *    texte d'option, seulement un audio et des images) ;
 *  - quelques totaux pour les vignettes du tableau de bord.
 *
 * Comme pour les révisions (weakSpots), seule la dernière passe d'un élève
 * sur un exercice compte pour son statut « réussi du premier coup » ; le
 * nombre d'erreurs, lui, cumule tout l'historique.
 */
import type { ContentBlock, Exercise, QuizExercise } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "./exerciseEvents";
import { lastRun } from "./weakSpots";

export interface InsightLesson { id: string; title: string; blocks: ContentBlock[] }
export interface InsightUser   { id: string; name: string }

export interface StudentLessonRow {
  userId: string;
  userName: string;
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
  /** Réponses fausses, tout l'historique. */
  wrongAttempts: number;
  /** Exercices à revoir (ratés ou non terminés lors de la dernière passe). */
  toReview: number;
  lastActivityAt: string;
}

/** Une réponse lisible : texte, image, ou les deux. */
export interface AnswerDescriptor {
  /** Identifiant stable pour regrouper (id d'option, phrase…). */
  key: string;
  text: string | null;
  imageUrl: string | null;
}

export interface WrongAnswerCount extends AnswerDescriptor { count: number }

export interface ExerciseStudent {
  userId: string;
  userName: string;
  /** Réponses fausses de cet élève sur cet exercice, tout l'historique. */
  wrongAttempts: number;
  /** L'exercice a-t-il fini par être réussi lors de la dernière passe ? */
  completed: boolean;
  /** Réponses fausses de cet élève, les plus fréquentes d'abord. */
  wrongAnswers: WrongAnswerCount[];
}

export interface ExerciseDifficulty {
  lessonId: string;
  lessonTitle: string;
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
  /** Élèves ayant répondu au moins une fois. */
  studentsAttempted: number;
  /** Élèves dont la dernière passe n'est pas une réussite du premier coup. */
  studentsFailedFirstTry: number;
  /** Réponses fausses, tous élèves et tout l'historique. */
  wrongAttempts: number;
  /** Réponses fausses les plus fréquentes, tous élèves confondus. */
  topWrongAnswers: WrongAnswerCount[];
  /** Élèves en difficulté sur cet exercice, du plus en difficulté au moins. */
  students: ExerciseStudent[];
}

export interface TeacherStats {
  /** Élèves ayant eu une activité dans les 30 derniers jours. */
  activeStudents: number;
  /** Exercices joués (couples élève × exercice avec au moins un événement). */
  exercisesPlayed: number;
  /** Taux global de réussite du premier coup, null sans essai. */
  firstTryRate: number | null;
}

export interface TeacherInsights {
  rows: StudentLessonRow[];
  hardest: ExerciseDifficulty[];
  stats: TeacherStats;
}

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const TOP_WRONG_ANSWERS = 3;
const MAX_HARDEST = 10;

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

function keyOf(userId: string, lessonId: string): string {
  return `${userId} ${lessonId}`;
}

function countAnswers(descriptors: AnswerDescriptor[]): WrongAnswerCount[] {
  const map = new Map<string, WrongAnswerCount>();
  for (const d of descriptors) {
    const cur = map.get(d.key);
    if (cur) cur.count += 1; else map.set(d.key, { ...d, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.text ?? "").localeCompare(b.text ?? ""));
}

interface DifficultyAccumulator extends Omit<ExerciseDifficulty, "topWrongAnswers" | "students"> {
  allWrong: AnswerDescriptor[];
  students: ExerciseStudent[];
}

export function buildTeacherInsights(
  lessons: InsightLesson[],
  users: InsightUser[],
  events: ExerciseEventRow[],
  now: Date = new Date(),
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

  const rows = new Map<string, StudentLessonRow>();
  const difficulties = new Map<string, DifficultyAccumulator>();
  const activeUsers = new Set<string>();
  let exercisesPlayed = 0;
  let totalAttempted = 0;
  let totalFirstTry = 0;
  const activeSince = now.getTime() - ACTIVE_WINDOW_MS;

  for (const lesson of lessons) {
    const exerciseBlocks = lesson.blocks.filter(
      (b): b is Extract<ContentBlock, { type: "exercise" }> => b.type === "exercise",
    );

    for (const [userId, byLesson] of tree) {
      const byBlock = byLesson.get(lesson.id);
      if (!byBlock) continue;

      let row = rows.get(keyOf(userId, lesson.id));
      exerciseBlocks.forEach((block, blockIndex) => {
        const all = byBlock.get(block.id);
        if (!all || all.length === 0) return;

        all.sort((a, b) => a.created_at.localeCompare(b.created_at));
        const run = lastRun(all);
        const attemptsInRun = run.filter((e) => e.event_type === "attempt");
        const firstTryOk =
          attemptsInRun.length > 0 &&
          attemptsInRun[0].correct === true &&
          !run.some((e) => e.event_type === "hint");
        const completed = run.some((e) => e.event_type === "complete");
        const wrongAll = all.filter((e) => e.event_type === "attempt" && e.correct === false);
        const lastAt = all[all.length - 1].created_at;

        if (!row) {
          row = {
            userId, userName: nameOf(userId), lessonId: lesson.id, lessonTitle: lesson.title,
            exercisesTotal: exerciseBlocks.length, exercisesSeen: 0, exercisesAttempted: 0,
            firstTrySuccesses: 0, firstTryRate: null, wrongAttempts: 0, toReview: 0, lastActivityAt: lastAt,
          };
          rows.set(keyOf(userId, lesson.id), row);
        }
        row.exercisesSeen += 1;
        row.wrongAttempts += wrongAll.length;
        if (lastAt > row.lastActivityAt) row.lastActivityAt = lastAt;
        exercisesPlayed += 1;
        if (new Date(lastAt).getTime() >= activeSince) activeUsers.add(userId);

        if (attemptsInRun.length === 0) return;

        row.exercisesAttempted += 1;
        totalAttempted += 1;
        if (firstTryOk) { row.firstTrySuccesses += 1; totalFirstTry += 1; }
        else row.toReview += 1;

        const dKey = `${lesson.id} ${block.id}`;
        let d = difficulties.get(dKey);
        if (!d) {
          const ex = block.exercise;
          d = {
            lessonId: lesson.id, lessonTitle: lesson.title, blockId: block.id,
            type: ex.type, position: blockIndex + 1,
            label: exerciseSummaryLabel(ex, blockIndex + 1),
            correctAnswer: correctAnswerOf(ex),
            hasAudio: (ex.type === "quiz" || ex.type === "wordorder") && Boolean(ex.audioDataUrl),
            studentsAttempted: 0, studentsFailedFirstTry: 0, wrongAttempts: 0,
            allWrong: [], students: [],
          };
          difficulties.set(dKey, d);
        }
        d.studentsAttempted += 1;
        d.wrongAttempts += wrongAll.length;

        const wrongDescriptors: AnswerDescriptor[] = [];
        for (const e of wrongAll) {
          const desc = describeAnswerRich(block.exercise, e.answer);
          if (desc) wrongDescriptors.push(desc);
        }
        d.allWrong.push(...wrongDescriptors);

        if (!firstTryOk) {
          d.studentsFailedFirstTry += 1;
          d.students.push({
            userId, userName: nameOf(userId),
            wrongAttempts: wrongAll.length, completed,
            wrongAnswers: countAnswers(wrongDescriptors),
          });
        }
      });
      if (row) row.firstTryRate = row.exercisesAttempted > 0 ? row.firstTrySuccesses / row.exercisesAttempted : null;
    }
  }

  const rowList = [...rows.values()].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  const hardest: ExerciseDifficulty[] = [...difficulties.values()]
    .filter((d) => d.wrongAttempts > 0 || d.studentsFailedFirstTry > 0)
    .map(({ allWrong, students, ...d }) => ({
      ...d,
      topWrongAnswers: countAnswers(allWrong).slice(0, TOP_WRONG_ANSWERS),
      students: [...students].sort((a, b) =>
        Number(a.completed) - Number(b.completed) ||
        b.wrongAttempts - a.wrongAttempts ||
        a.userName.localeCompare(b.userName)),
    }))
    .sort((a, b) =>
      b.studentsFailedFirstTry - a.studentsFailedFirstTry ||
      b.wrongAttempts - a.wrongAttempts ||
      a.lessonTitle.localeCompare(b.lessonTitle) ||
      a.position - b.position)
    .slice(0, MAX_HARDEST);

  return {
    rows: rowList,
    hardest,
    stats: {
      activeStudents: activeUsers.size,
      exercisesPlayed,
      firstTryRate: totalAttempted > 0 ? totalFirstTry / totalAttempted : null,
    },
  };
}

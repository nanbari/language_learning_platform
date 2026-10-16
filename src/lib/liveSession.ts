import type { Slide } from "@/lib/presentation";

/**
 * Séance en direct : l'enseignant présente, les élèves suivent les mêmes
 * écrans sur leur appareil et répondent eux-mêmes aux jeux. Les messages
 * transitent par un canal Supabase Realtime (Broadcast + Presence) nommé
 * d'après le salon de la séance, tiré au hasard par le serveur au lancement
 * et donné aux seuls élèves de la classe (voir lib/classes). Les écrans et
 * les réponses, eux, ne sont pas stockés en base.
 */

/** État diffusé par l'enseignant à chaque changement d'écran ou d'étape. */
export interface LiveState {
  index: number;
  total: number;
  step: number;
  slide: Slide;
  /** La solution du jeu en cours est affichée chez tout le monde. */
  revealed: boolean;
}

/** Réponse d'un élève à un jeu (chaque essai est envoyé). */
export interface LiveAnswer {
  slideIndex: number;
  studentId: string;
  name: string;
  choiceId: string;
  correct: boolean;
}

export interface Participant {
  id: string;
  name: string;
}

interface StudentResult {
  name: string;
  firstChoiceId: string;
  firstCorrect: boolean;
  found: boolean;
}

/** Réponses reçues, par écran puis par élève. */
export type Tally = Record<number, Record<string, StudentResult>>;

export function channelName(room: string): string {
  return `ms-live-${room}`;
}

const GAME_KINDS: Slide["kind"][] = ["quiz", "clipQuiz", "qcm", "findLetter", "pickSound", "findInWord", "completeWord", "write"];

/** Les jeux sont les seuls écrans où l'élève répond. */
export function isGame(slide: Slide): boolean {
  return GAME_KINDS.includes(slide.kind);
}

/** Seul le premier essai d'un élève compte pour le décompte par choix. */
export function recordAnswer(tally: Tally, answer: LiveAnswer): Tally {
  const slide = tally[answer.slideIndex] ?? {};
  const previous = slide[answer.studentId];
  const next: StudentResult = previous
    ? { ...previous, found: previous.found || answer.correct }
    : { name: answer.name, firstChoiceId: answer.choiceId, firstCorrect: answer.correct, found: answer.correct };
  return { ...tally, [answer.slideIndex]: { ...slide, [answer.studentId]: next } };
}

export interface SlideSummary {
  answered: number;
  /** Prénoms des élèves ayant trouvé, dans l'ordre d'arrivée. */
  found: string[];
  /** Nombre de premiers essais par choix. */
  counts: Record<string, number>;
}

export function summarize(tally: Tally, slideIndex: number): SlideSummary {
  const results = Object.values(tally[slideIndex] ?? {});
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.firstChoiceId] = (counts[r.firstChoiceId] ?? 0) + 1;
  return {
    answered: results.length,
    found: results.filter((r) => r.found).map((r) => r.name),
    counts,
  };
}

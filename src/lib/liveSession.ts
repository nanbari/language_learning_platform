import { isRightForm, type Slide } from "@/lib/presentation";

/**
 * Séance en direct : l'enseignant présente, les élèves suivent les mêmes
 * écrans sur leur appareil et répondent eux-mêmes aux jeux.
 *
 * Tout passe par le serveur, qui connaît la classe et ses membres :
 * - l'enseignant dépose l'écran courant (PUT /api/classes/:id/live/state) ;
 * - les élèves le relisent (GET …/live/state) et envoient leurs réponses
 *   (POST …/live/answers), dont le serveur établit lui-même l'exactitude ;
 * - l'enseignant seul relit les réponses (GET …/live/answers).
 * Le salon (`room`, tiré au hasard au lancement) identifie la séance ; il ne
 * donne aucun droit à lui seul : chaque requête vérifie la session et
 * l'appartenance à la classe. Un canal Supabase Realtime privé, ouvert avec
 * un jeton émis par le serveur, sert seulement à prévenir qu'il y a du neuf
 * (et à l'appel vidéo, lib/useLiveVideo) ; sans lui, la relecture périodique
 * suffit. Les écrans et les réponses d'une séance sont effacés à sa fin.
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

/**
 * Réponse d'un élève à un jeu (chaque essai est envoyé), telle que le
 * serveur l'a enregistrée : l'élève est celui de la session, l'exactitude
 * est calculée côté serveur (`isCorrectChoice`), jamais reçue du client.
 */
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

/** Ce que l'élève reçoit en relisant la séance. */
export type LiveRoomView =
  | { status: "live"; state: LiveState | null }
  /** Le salon n'est plus celui de la classe : l'enseignant a terminé (ou relancé) le cours. */
  | { status: "ended" };

/** Ce que l'enseignant reçoit en relisant les réponses. */
export interface LiveHostView {
  answers: LiveAnswer[];
  /** Élèves vus ces dernières secondes. */
  participants: Participant[];
}

/** Durée d'un jeton Realtime émis par le serveur (server/liveToken). */
export const LIVE_TOKEN_TTL_SECONDS = 15 * 60;
/** Le navigateur redemande un jeton avant l'expiration : la marge couvre une requête lente. */
export const LIVE_TOKEN_REFRESH_SECONDS = 10 * 60;

/** Sujets Realtime de la séance (canaux privés, voir migration 2026-10-28). */
export function liveTopics(room: string) {
  return {
    /** Le serveur seul y publie (état, réponses reçues, fin, micro coupé) ; enseignant et élèves y écoutent. */
    control: `live:${room}:control`,
    /** Mise en relation WebRTC entre les participants. */
    video: `live:${room}:video`,
  };
}

/** Au-delà de cette durée sans nouvelle, un élève n'est plus compté présent. */
export const PRESENCE_WINDOW_MS = 15_000;
/** Taille maximale, en octets JSON, d'un état déposé par l'enseignant. */
export const MAX_STATE_BYTES = 256 * 1024;

/** Le corps d'un PUT …/live/state a-t-il la forme d'un LiveState ? (contenu des diapositives non vérifié : il vient de l'enseignant) */
export function isLiveState(value: unknown): value is LiveState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.index) && Number.isInteger(v.total) && Number.isInteger(v.step)
    && (v.index as number) >= 0 && (v.total as number) >= 1 && (v.index as number) < (v.total as number)
    && typeof v.revealed === "boolean"
    && typeof v.slide === "object" && v.slide !== null && typeof (v.slide as { kind?: unknown }).kind === "string";
}

/**
 * Le choix est-il la bonne réponse de l'écran ? `null` si l'écran n'est pas
 * un jeu ou si le choix n'en fait pas partie (réponse à refuser).
 */
export function isCorrectChoice(slide: Slide, choiceId: string): boolean | null {
  switch (slide.kind) {
    case "findLetter":
    case "pickSound":
    case "findInWord":
      if (!slide.choices.some((l) => String(l.id) === choiceId)) return null;
      return String(slide.target.id) === choiceId;
    case "completeWord": {
      const choice = slide.choices.find((c) => c.position === choiceId);
      return choice ? isRightForm(slide, choice) : null;
    }
    case "quiz":
      if (!slide.choices.some((w) => w.id === choiceId)) return null;
      return slide.target.id === choiceId;
    case "clipQuiz":
      if (!slide.choices.some((c) => c.id === choiceId)) return null;
      return slide.target.id === choiceId;
    case "qcm":
      if (!slide.qcm.options.some((o) => o.id === choiceId)) return null;
      return slide.qcm.correctId === choiceId;
    case "write":
      return choiceId === "done" ? true : null;
    default:
      return null;
  }
}

/** Reconstruit le décompte à partir des réponses, dans l'ordre d'arrivée (le premier essai de chacun compte). */
export function buildTally(answers: readonly LiveAnswer[]): Tally {
  return answers.reduce<Tally>((tally, answer) => recordAnswer(tally, answer), {});
}

interface StudentResult {
  name: string;
  firstChoiceId: string;
  firstCorrect: boolean;
  found: boolean;
}

/** Réponses reçues, par écran puis par élève. */
export type Tally = Record<number, Record<string, StudentResult>>;

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

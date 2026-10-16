/**
 * Jeux du bloc « Lettres » vus comme des exercices de leçon.
 *
 * Le paquet de lettres (buildLetterDeck) est tiré au hasard à chaque
 * passage : un jeu est donc identifié par ce qu'il demande (type de jeu,
 * lettre visée, position), pas par sa place dans le paquet. Cet identifiant
 * sert de `block_id` dans exercise_events, ce qui permet à l'analyse des
 * points faibles (weakSpots) de retrouver les jeux ratés et de les faire
 * rejouer en révision.
 *
 * L'écriture (tracé) n'est pas un jeu à choix : elle ne peut pas être ratée
 * et n'est donc pas suivie ici.
 */
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LETTER_POSITIONS } from "@/data/letterWords";
import { buildLetterDeck, type LetterLevel, type Slide } from "./presentation";

/** Bloc « Lettres » d'une leçon : les lettres du jour, présentées puis travaillées comme en cours en direct. */
export interface LettersBlock { id: string; type: "letters"; level: LetterLevel; letterIds: number[]; reviewIds?: number[] }

export const LETTER_GAME_KINDS = ["pickSound", "findLetter", "findInWord", "completeWord"] as const;
export type LetterGameSlide = Extract<Slide, { kind: (typeof LETTER_GAME_KINDS)[number] }>;

/** Jeu de lettres rejoué en révision. */
export interface LetterGameExercise { type: "letterGame"; slide: LetterGameSlide }

export function isLetterGameSlide(slide: Slide): slide is LetterGameSlide {
  return (LETTER_GAME_KINDS as readonly string[]).includes(slide.kind);
}

export function isLettersBlock(block: unknown): block is LettersBlock {
  return typeof block === "object" && block !== null && (block as { type?: unknown }).type === "letters";
}

/** Identifiant stable d'un jeu de lettres (block_id des événements, 64 caractères au plus). */
export function letterGameId(blockId: string, slide: LetterGameSlide): string {
  const letterId = slide.kind === "completeWord" ? slide.letter.id : slide.target.id;
  const position = slide.kind === "completeWord" ? `:${slide.position}` : "";
  return `${blockId}:${slide.kind}:${letterId}${position}`;
}

/** Jeux de lettres d'un bloc, avec leur identifiant stable. */
export function letterGames(block: LettersBlock, rng?: () => number): { id: string; exercise: LetterGameExercise }[] {
  return buildLetterDeck(block.letterIds, block.level, block.reviewIds ?? [], rng)
    .filter(isLetterGameSlide)
    .map((slide) => ({ id: letterGameId(block.id, slide), exercise: { type: "letterGame", slide } }));
}

const KIND_LABELS: Record<LetterGameSlide["kind"], string> = {
  pickSound: "Choisir le son",
  findLetter: "Retrouver la lettre",
  findInWord: "Retrouver la lettre dans le mot",
  completeWord: "Compléter le mot",
};

/**
 * Réponse lisible : la lettre choisie, ou la forme choisie pour « compléter
 * le mot ». Lue dans l'alphabet et non dans les choix du jeu, tirés au
 * hasard à chaque passage.
 */
export function describeLetterAnswer(slide: LetterGameSlide, choiceId: string): string | null {
  if (slide.kind === "completeWord") {
    return (LETTER_POSITIONS as readonly string[]).includes(choiceId) ? slide.letter[choiceId as keyof typeof slide.letter] as string : null;
  }
  return ARABIC_ALPHABET.find((l) => String(l.id) === choiceId)?.isolated ?? null;
}

/** Libellé court : « Choisir le son · ب ». */
export function letterGameLabel(slide: LetterGameSlide): string {
  const letter = slide.kind === "completeWord" ? slide.letter : slide.target;
  return `${KIND_LABELS[slide.kind]} · ${letter.isolated}`;
}

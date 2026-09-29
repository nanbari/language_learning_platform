// Données des vidéos récapitulatives, fournies par le site au moment du rendu
// (voir src/lib/recapVideo.ts) : le projet Remotion ne lit rien du site.

/** Tracé d'une lettre isolée, repère 1000 × 1000 (copie de src/data/letterStrokes). */
export interface RecapLetter {
  char: string;
  color: string;
  outline: string;
  strokes: { d: string; width: number }[];
  marks: { cx: number; cy: number; r: number }[];
}

export type LettersRecapProps = {
  letters: RecapLetter[];
};

/** Un mot : son image (ou emoji), le mot écrit s'il existe, et son animation éventuelle. */
export interface RecapWord {
  imageUrl?: string;
  emoji?: string;
  arabic?: string;
  /** Chemin d'un clip de public/ (ex. animations/fruits/pomme-couper.mp4). */
  clip?: string;
}

export type VocabRecapProps = {
  title?: string | null;
  color: string;
  words: RecapWord[];
};

export const RECAP_FPS = 30;
/** Une lettre : tracé en 2 s, puis la lettre reste environ 3 s avant de disparaître. */
export const LETTER_FRAMES = 170;
/** Carte d'un mot, puis son animation s'il en a une. */
export const WORD_FRAMES = 150;
export const CLIP_FRAMES = 120;
/** Écran d'ouverture (titre). */
export const OPEN_FRAMES = 75;
/**
 * Fin : les cartes arrivent une à une, avec une pause entre deux, puis
 * restent toutes ensemble avant la fin de la vidéo.
 */
export const END_DELAY = 10;
export const END_STAGGER = 60;
export const END_HOLD = 120;

export function endFrames(cards: number): number {
  return END_DELAY + cards * END_STAGGER + END_HOLD;
}

/** Vidéo d'introduction d'une leçon : ses parties (lettres, vocabulaire) dans l'ordre de la leçon. */
export type LessonRecapPart = ({ kind: "letters" } & LettersRecapProps) | ({ kind: "vocab" } & VocabRecapProps);

export type LessonRecapProps = {
  parts: LessonRecapPart[];
};

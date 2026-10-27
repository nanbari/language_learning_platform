/**
 * Ce qu'un élève joue réellement dans une leçon : un bloc « Lettres » n'est
 * pas une activité, c'est une suite de jeux (choisir le son, retrouver la
 * lettre, l'écrire). Compter les blocs « exercise » affichait « 0 exercice »
 * pour une leçon de lettres pourtant jouable.
 */
import { ARABIC_ALPHABET, type ArabicLetter } from "@/data/arabicAlphabet";
import { buildLetterDeck, type Slide } from "@/lib/presentation";
import { isGame } from "@/lib/liveSession";
import { isLettersBlock, type LettersBlock } from "@/lib/letterExercises";

/** Rang d'un exercice de lettres : le son d'abord, l'écriture en dernier. */
function exerciseRank(slide: Slide): number {
  if (slide.kind === "pickSound") return 0;
  if (slide.kind === "write") return 2;
  return 1;
}

/**
 * Les jeux d'un bloc « Lettres » joué en autonomie : ni écrans de
 * présentation (titre, tracé, formes), ni « bravo » final. Ordre : choisir
 * le son, retrouver la lettre, puis l'écrire. Les choix sont tirés au
 * hasard à chaque appel ; le nombre de jeux, lui, ne dépend que du bloc.
 */
export function letterPlayDeck(block: LettersBlock): Slide[] {
  return buildLetterDeck(block.letterIds, block.level, block.reviewIds ?? [])
    .filter(isGame)
    .sort((a, b) => exerciseRank(a) - exerciseRank(b));
}

/** Nombre d'activités que l'élève traverse : un écran par bloc, un par jeu de lettres. */
export function countActivities(blocks: { type: string }[]): number {
  return blocks.reduce((n, b) => n + (isLettersBlock(b) ? letterPlayDeck(b).length : 1), 0);
}

export type LessonCover =
  | { kind: "image"; url: string }
  | { kind: "letter"; letter: ArabicLetter }
  | { kind: "none" };

interface CoverBlock {
  type: string;
  slides?: { imageDataUrl?: string }[];
  exercise?: { type: string; options?: { id: string; imageDataUrl?: string }[]; correctId?: string };
  letterIds?: number[];
}

/**
 * Couverture d'une leçon, prise dans son propre contenu : la première image
 * de diaporama, sinon l'image de la bonne réponse du premier quiz illustré,
 * sinon la première lettre du jour. Rien n'est inventé.
 */
export function lessonCover(blocks: { type: string }[]): LessonCover {
  for (const b of blocks as CoverBlock[]) {
    const slide = b.type === "slideshow" ? b.slides?.find((s) => s.imageDataUrl) : undefined;
    if (slide?.imageDataUrl) return { kind: "image", url: slide.imageDataUrl };
    if (b.type === "exercise" && b.exercise?.type === "quiz") {
      const right = b.exercise.options?.find((o) => o.id === b.exercise?.correctId);
      if (right?.imageDataUrl) return { kind: "image", url: right.imageDataUrl };
    }
  }
  for (const b of blocks as CoverBlock[]) {
    const letter = b.type === "letters" ? ARABIC_ALPHABET.find((l) => l.id === b.letterIds?.[0]) : undefined;
    if (letter) return { kind: "letter", letter };
  }
  return { kind: "none" };
}

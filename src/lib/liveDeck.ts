/**
 * D'une leçon d'enseignant à son diaporama de cours en direct : les parties
 * de la leçon (lettres, vocabulaire) dans l'ordre de ses blocs, les lettres
 * du jour, puis les images dans l'ordre de la leçon.
 *
 * Module pur (ni React ni accès réseau) : il sert au serveur et aux tests.
 */
import { imageWord } from "@/data/imageWords";
import {
  buildLetterDeck, buildVocabDeck, combineDecks, lessonQcms, lessonVocabWords, lettersPerLesson,
  MIN_VOCAB_WORDS, type LetterLevel, type Qcm, type Rng, type Slide, type VocabWord,
} from "@/lib/presentation";

/** Bloc « Lettres » d'une leçon : ce que l'enseignant choisissait jusqu'ici au lancement du cours. */
export interface LettersBlock {
  id: string;
  type: "letters";
  level: LetterLevel;
  letterIds: number[];
  reviewIds: number[];
}

/** Le diaporama enregistré avec la leçon (colonne `exercises.live`). */
export interface SavedDeck {
  /** Empreinte du contenu dont il est tiré (voir lib/lessonDeck). */
  key: string;
  slides: Slide[];
  createdAt: string;
}

export type LessonPart =
  | { kind: "letters"; level: LetterLevel; letterIds: number[]; reviewIds: number[] }
  | { kind: "vocab"; title: string; color: string; words: VocabWord[]; qcms: Qcm[] };

function isLettersBlock(block: unknown): block is LettersBlock {
  return (block as { type?: string })?.type === "letters";
}

/**
 * Les parties d'une leçon, dans l'ordre de ses blocs : ses lettres (bloc
 * « Lettres » complet) et son vocabulaire (au moins {@link MIN_VOCAB_WORDS}
 * images, ou un QCM). Chaque image garde sa place dans la leçon : le
 * diaporama ne tire pas les mots au sort.
 */
export function lessonParts(title: string, blocks: readonly unknown[], color: string): LessonPart[] {
  const parts: { at: number; part: LessonPart }[] = [];

  const lettersAt = blocks.findIndex(isLettersBlock);
  if (lettersAt >= 0) {
    const block = blocks[lettersAt] as LettersBlock;
    if (block.letterIds.length === lettersPerLesson(block.level)) {
      parts.push({ at: lettersAt, part: { kind: "letters", level: block.level, letterIds: block.letterIds, reviewIds: block.reviewIds ?? [] } });
    }
  }

  const words = lessonVocabWords(blocks).map((w, rank) => ({ ...w, rank }));
  const qcms = lessonQcms(blocks, imageWord);
  if (words.length >= MIN_VOCAB_WORDS || qcms.length > 0) {
    const vocabAt = blocks.findIndex((b) => {
      const type = (b as { type?: string })?.type;
      return type === "slideshow" || type === "exercise";
    });
    parts.push({ at: vocabAt, part: { kind: "vocab", title, color, words, qcms } });
  }

  return parts.sort((a, b) => a.at - b.at).map((p) => p.part);
}

/** Le diaporama du cours en direct, tiré des parties de la leçon. */
export function buildLessonDeck(parts: readonly LessonPart[], rng: Rng = Math.random): Slide[] {
  return combineDecks(parts.map((part) =>
    part.kind === "letters"
      ? buildLetterDeck(part.letterIds, part.level, part.reviewIds, rng)
      : buildVocabDeck(part.title, part.words, part.words.length, part.qcms, part.color, rng),
  ));
}

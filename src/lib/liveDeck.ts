/**
 * D'une leçon d'enseignant à sa vidéo d'introduction, puis à son diaporama de
 * cours en direct. Les deux suivent le même contenu, dans le même ordre :
 * les parties de la leçon (lettres, vocabulaire) dans l'ordre de ses blocs,
 * les lettres du jour, les mots dans l'ordre où la vidéo les montre.
 *
 * Module pur (ni React ni accès réseau) : il sert au serveur, au rendu par
 * GitHub Actions et aux tests.
 */
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LETTER_STROKES } from "@/data/letterStrokes";
import { clipRank, clipsFor } from "@/data/animations";
import { imageWord } from "@/data/imageWords";
import {
  buildLetterDeck, buildVocabDeck, combineDecks, lessonQcms, lessonVocabWords, letterColor, lettersPerLesson,
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
  /** Empreinte de la vidéo dont il est tiré. */
  key: string;
  slides: Slide[];
  videoUrl: string;
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
 * images, ou un QCM). Les mots sont rangés comme en séance : la première
 * image, puis les mots animés dans leur ordre fixe, puis les autres dans
 * l'ordre de la leçon.
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

  const [cover, ...rest] = lessonVocabWords(blocks).map((w) => ({ ...w, clips: clipsFor(w.imageUrl) }));
  const ranked = rest.filter((w) => clipRank(w.imageUrl) !== undefined).sort((a, b) => clipRank(a.imageUrl)! - clipRank(b.imageUrl)!);
  const others = rest.filter((w) => clipRank(w.imageUrl) === undefined);
  // Chaque mot garde sa place : le diaporama ne tire plus les mots au sort.
  const words = (cover ? [cover, ...ranked, ...others] : []).map((w, rank) => ({ ...w, rank }));
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

/** Une partie de la vidéo, telle que la lit le projet Remotion (animations/src/recap/types.ts). */
export type RecapPart =
  | { kind: "letters"; letters: { char: string; color: string; outline: string; strokes: { d: string; width: number }[]; marks: { cx: number; cy: number; r: number }[] }[] }
  | { kind: "vocab"; title: string | null; color: string; words: { imageUrl?: string; arabic?: string; clip?: string }[] };

/** Données de la vidéo d'introduction (composition `recap-lecon` du projet Remotion). */
export function recapProps(parts: readonly LessonPart[]): { parts: RecapPart[] } {
  return {
    parts: parts.flatMap((part): RecapPart[] => {
      if (part.kind === "letters") {
        const letters = part.letterIds
          .map((id) => ARABIC_ALPHABET.find((l) => l.id === id))
          .flatMap((letter) => {
            const glyph = letter && LETTER_STROKES[letter.isolated];
            if (!letter || !glyph) return [];
            return [{
              char: letter.isolated,
              color: letterColor(letter),
              outline: glyph.outline,
              strokes: glyph.strokes.map(({ d, width }) => ({ d, width })),
              marks: glyph.marks,
            }];
          });
        return [{ kind: "letters", letters }];
      }
      if (part.words.length === 0) return [];
      return [{
        kind: "vocab",
        // Le titre n'est écrit que s'il est en arabe (aucun texte français).
        // `null` explicite : sinon Remotion garderait le titre de l'exemple (defaultProps).
        title: /[؀-ۿ]/.test(part.title) ? part.title : null,
        color: part.color,
        words: part.words.map((w) => {
          const clip = w.clips?.[0];
          return { imageUrl: w.imageUrl, arabic: w.arabic, ...(clip && { clip: clip.src.replace(/^\//, "") }) };
        }),
      }];
    }),
  };
}

/** Le diaporama du cours en direct, tiré des mêmes parties que la vidéo. */
export function buildLessonDeck(parts: readonly LessonPart[], rng: Rng = Math.random): Slide[] {
  return combineDecks(parts.map((part) =>
    part.kind === "letters"
      ? buildLetterDeck(part.letterIds, part.level, part.reviewIds, rng)
      : buildVocabDeck(part.title, part.words, part.words.length, part.qcms, part.color, rng),
  ));
}

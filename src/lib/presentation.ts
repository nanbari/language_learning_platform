import { ARABIC_ALPHABET, type ArabicLetter } from "@/data/arabicAlphabet";
import { VOCAB_THEMES, type ArabicWord } from "@/data/arabicVocabulary";

/**
 * Mode présentation : construit la suite d'écrans qu'un enseignant projette
 * en partage d'écran pendant un cours en direct. Tout est visuel — la voix
 * est celle de l'enseignant, aucun audio n'est joué.
 */

export type Slide =
  | { kind: "title"; emoji: string; title: string; arabic?: string; color: string }
  /** Annonce des lettres du jour : elles apparaissent une à une, jamais ensemble d'emblée. */
  | { kind: "lettersTitle"; letters: ArabicLetter[] }
  | { kind: "letter"; letter: ArabicLetter; arabicName: boolean }
  | { kind: "forms"; letter: ArabicLetter }
  | { kind: "example"; letter: ArabicLetter; emoji: string | null }
  | { kind: "findLetter"; target: ArabicLetter; choices: ArabicLetter[] }
  | { kind: "flashcard"; word: ArabicWord; color: string }
  | { kind: "blur"; word: ArabicWord; color: string }
  | { kind: "missing"; words: ArabicWord[]; missingId: string; color: string }
  | { kind: "quiz"; target: ArabicWord; choices: ArabicWord[]; color: string }
  | { kind: "bravo"; /** Sans félicitation écrite en arabe (débutants). */ plain?: boolean };

export type Rng = () => number;

/**
 * Niveau d'une leçon de lettre. Un débutant ne lit pas encore : sa leçon
 * s'en tient à la lettre isolée — ni formes début/milieu/fin, ni mot écrit
 * en arabe (mot-exemple, nom de la lettre).
 */
export type LetterLevel = "beginner" | "advanced";

/**
 * Teintes de la charte graphique assez soutenues pour du texte sur fond
 * crème (le rose poudré Petal, trop clair, est réservé aux aplats). Les
 * couleurs vives des données servent aux pages d'exercices, pas ici.
 */
export const CHARTER_COLORS = ["#BB908E", "#8BA3B1", "#6B705C", "#7B868E", "#999B84"] as const;

export function charterColor(n: number): string {
  return CHARTER_COLORS[n % CHARTER_COLORS.length];
}

function inCharter(letter: ArabicLetter): ArabicLetter {
  return { ...letter, color: charterColor(letter.id - 1) };
}

export const WORD_COUNTS = [4, 6, 8] as const;
export const LETTERS_PER_LESSON = 3;
/** Nombre maximal de lettres à réviser en fin de séance. */
export const MAX_REVIEW_LETTERS = 6;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Nombre de révélations successives d'un écran : « Suivant » les déroule une
 * à une avant de passer à l'écran d'après. Les jeux (quiz, lettre à trouver)
 * se jouent au clic et n'ont pas d'étapes.
 *
 * Aucun écran ne porte de texte français — ni la présentation ni les
 * exercices : uniquement de l'arabe et des images. L'enseignant énonce les
 * consignes à voix haute.
 */
export function stepsFor(slide: Slide): number {
  switch (slide.kind) {
    case "lettersTitle": return slide.letters.length - 1;
    case "letter": return slide.arabicName ? 1 : 0;
    case "forms": return 3;
    case "flashcard": return 1;
    case "blur": return 3;
    case "missing": return 2;
    default: return 0;
  }
}

/** Emoji du mot-exemple d'une lettre, s'il figure dans le vocabulaire. */
export function findWordEmoji(arabic: string): string | null {
  for (const theme of VOCAB_THEMES) {
    const word = theme.words.find((w) => w.arabic === arabic);
    if (word) return word.emoji;
  }
  return null;
}

/** L'élève choisit parmi les seules lettres de la leçon, dans un ordre tiré au sort. */
function findLetterSlide(target: ArabicLetter, lesson: ArabicLetter[], rng: Rng): Slide {
  return { kind: "findLetter", target, choices: shuffle(lesson, rng) };
}

/**
 * Leçon de lettres (trois par leçon côté interface). Toutes les lettres
 * sont d'abord présentées ; les exercices viennent ensuite, en fin de
 * séance : chaque lettre du jour est à retrouver parmi celles de la leçon,
 * puis viennent les lettres que l'enseignant a choisi de faire réviser.
 */
export function buildLetterDeck(
  letterIds: number[],
  level: LetterLevel,
  reviewIds: number[] = [],
  rng: Rng = Math.random,
): Slide[] {
  const letters = ARABIC_ALPHABET.filter((l) => letterIds.includes(l.id)).map(inCharter);
  if (letters.length === 0) return [];

  const advanced = level === "advanced";
  const deck: Slide[] = [{ kind: "lettersTitle", letters }];

  for (const letter of letters) {
    deck.push({ kind: "letter", letter, arabicName: advanced });
    if (advanced) {
      deck.push({ kind: "forms", letter }, { kind: "example", letter, emoji: findWordEmoji(letter.example) });
    }
  }

  // Exercices, une fois la présentation terminée : les lettres du jour, dans le désordre.
  for (const letter of shuffle(letters, rng)) deck.push(findLetterSlide(letter, letters, rng));

  // Révision choisie par l'enseignant, en clôture : rappel des lettres une à
  // une, puis une manche par lettre. Trois cartes par manche, prises parmi les
  // lettres révisées et complétées au besoin par celles du jour.
  const review = ARABIC_ALPHABET
    .filter((l) => reviewIds.includes(l.id) && !letterIds.includes(l.id))
    .slice(0, MAX_REVIEW_LETTERS)
    .map(inCharter);
  if (review.length > 0) {
    deck.push({ kind: "lettersTitle", letters: review });
    for (const target of shuffle(review, rng)) {
      const others = [...shuffle(review.filter((l) => l.id !== target.id), rng), ...shuffle(letters, rng)];
      deck.push(findLetterSlide(target, [target, ...others.slice(0, LETTERS_PER_LESSON - 1)], rng));
    }
  }

  deck.push({ kind: "bravo", plain: !advanced });
  return deck;
}

export function buildVocabDeck(themeId: string, wordCount: number, rng: Rng = Math.random): Slide[] {
  const theme = VOCAB_THEMES.find((t) => t.id === themeId);
  if (!theme) return [];

  const color = charterColor(VOCAB_THEMES.indexOf(theme));
  const words = shuffle(theme.words, rng).slice(0, wordCount);
  const deck: Slide[] = [
    { kind: "title", emoji: theme.emoji, title: theme.nameFrench, arabic: theme.nameArabic, color },
    ...words.map((word): Slide => ({ kind: "flashcard", word, color })),
  ];

  for (const word of shuffle(words, rng).slice(0, 2)) {
    deck.push({ kind: "blur", word, color });
  }

  if (words.length >= 4) {
    const shown = shuffle(words, rng).slice(0, 4);
    deck.push({ kind: "missing", words: shown, missingId: shown[Math.floor(rng() * shown.length)].id, color });
  }

  for (const target of shuffle(words, rng).slice(0, 3)) {
    const others = shuffle(words.filter((w) => w.id !== target.id), rng).slice(0, 3);
    deck.push({ kind: "quiz", target, choices: shuffle([target, ...others], rng), color });
  }

  deck.push({ kind: "bravo" });
  return deck;
}

import { ARABIC_ALPHABET, type ArabicLetter } from "@/data/arabicAlphabet";
import { VOCAB_THEMES, type ArabicWord } from "@/data/arabicVocabulary";
import { LETTER_POSITIONS, LETTER_WORDS, type LetterWord } from "@/data/letterWords";

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
  /** Mot où la lettre étudiée, colorée, est au début, au milieu ou à la fin. */
  | { kind: "example"; letter: ArabicLetter; word: LetterWord }
  /** L'élève écrit la lettre au doigt : modèle en filigrane, puis simple pointillé. */
  | { kind: "write"; letter: ArabicLetter; guide: "full" | "dots" }
  | { kind: "findLetter"; target: ArabicLetter; choices: ArabicLetter[] }
  /** Niveau avancé : reconnaître la lettre colorée dans un mot, sous sa forme liée. */
  | { kind: "findInWord"; word: LetterWord; target: ArabicLetter; choices: ArabicLetter[] }
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
/** Cartes proposées à chaque manche de « Où est la lettre ? ». */
export const CHOICES_PER_ROUND = 3;

/**
 * Lettres par leçon : trois pour un débutant (lettre isolée seulement), une
 * seule au niveau avancé, où chaque lettre demande déjà tracé, formes et mot.
 */
export function lettersPerLesson(level: LetterLevel): number {
  return level === "advanced" ? 1 : 3;
}
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

/**
 * Trois cartes : la cible et deux autres lettres prises dans `pool`, par ordre
 * de préférence (lettres de la séance). Le tirage dans l'alphabet ne sert que
 * si la séance n'en fournit pas assez — leçon d'une lettre sans révision.
 */
function pickChoices(target: ArabicLetter, pool: ArabicLetter[], rng: Rng): ArabicLetter[] {
  const others = pool.filter((l) => l.id !== target.id).slice(0, CHOICES_PER_ROUND - 1);
  const taken = new Set([target.id, ...others.map((l) => l.id)]);
  const fillers = shuffle(ARABIC_ALPHABET.filter((l) => !taken.has(l.id)), rng)
    .slice(0, CHOICES_PER_ROUND - 1 - others.length)
    .map(inCharter);
  return shuffle([target, ...others, ...fillers], rng);
}

function findLetterSlide(target: ArabicLetter, pool: ArabicLetter[], rng: Rng): Slide {
  return { kind: "findLetter", target, choices: pickChoices(target, pool, rng) };
}

/** Un mot de la lettre (position tirée au sort) ; l'élève nomme la lettre colorée. */
function findInWordSlide(target: ArabicLetter, pool: ArabicLetter[], rng: Rng): Slide {
  const position = LETTER_POSITIONS[Math.floor(rng() * LETTER_POSITIONS.length)];
  return { kind: "findInWord", word: LETTER_WORDS[target.id][position], target, choices: pickChoices(target, pool, rng) };
}

/**
 * Leçon de lettres (nombre fixé par `lettersPerLesson`). Toutes les lettres
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
      deck.push({ kind: "forms", letter });
      for (const position of LETTER_POSITIONS) {
        deck.push({ kind: "example", letter, word: LETTER_WORDS[letter.id][position] });
      }
    }
  }

  const review = ARABIC_ALPHABET
    .filter((l) => reviewIds.includes(l.id) && !letterIds.includes(l.id))
    .slice(0, MAX_REVIEW_LETTERS)
    .map(inCharter);

  // Exercices, une fois la présentation terminée. D'abord l'écriture de chaque
  // lettre du jour, avec de moins en moins d'aide.
  for (const letter of letters) {
    deck.push({ kind: "write", letter, guide: "full" }, { kind: "write", letter, guide: "dots" });
  }

  // Puis les lettres du jour, dans le désordre, à retrouver d'abord parmi
  // elles, à défaut parmi les révisées.
  for (const letter of shuffle(letters, rng)) {
    deck.push(findLetterSlide(letter, [...shuffle(letters, rng), ...shuffle(review, rng)], rng));
  }

  // Révision choisie par l'enseignant, en clôture : rappel des lettres une à
  // une, puis une manche par lettre, parmi les révisées puis celles du jour.
  // Elle suit le niveau de la séance : lettre isolée pour le débutant, lettre
  // à reconnaître dans un mot pour le niveau avancé.
  if (review.length > 0) {
    const round = advanced ? findInWordSlide : findLetterSlide;
    deck.push({ kind: "lettersTitle", letters: review });
    for (const target of shuffle(review, rng)) {
      deck.push(round(target, [...shuffle(review, rng), ...shuffle(letters, rng)], rng));
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

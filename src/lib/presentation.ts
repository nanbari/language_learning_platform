import { ARABIC_ALPHABET, type ArabicLetter } from "@/data/arabicAlphabet";
import { LETTER_POSITIONS, LETTER_WORDS, exerciseWords, type LetterPosition, type LetterWord } from "@/data/letterWords";
import type { Clip } from "@/data/animations";

/**
 * Mode présentation : construit la suite d'écrans qu'un enseignant projette
 * en partage d'écran pendant un cours en direct. Tout est visuel — la voix
 * est celle de l'enseignant ; seul le jeu « choisir le son » joue de l'audio.
 */

export type Slide =
  /** Écran d'accueil, le temps que les élèves se connectent : le logo de l'association, ou un emoji. */
  | { kind: "title"; emoji?: string; title: string; arabic?: string; color: string }
  /** Annonce des lettres du jour : elles apparaissent une à une, jamais ensemble d'emblée. */
  | { kind: "lettersTitle"; letters: ArabicLetter[] }
  /** La lettre se trace seule : son nom n'est jamais écrit, à aucun niveau — l'enseignant le dit. */
  | { kind: "letter"; letter: ArabicLetter }
  /** Les trois formes liées ; sous chacune, un mot où la lettre, colorée, occupe cette position. */
  | { kind: "forms"; letter: ArabicLetter; words: Record<LetterPosition, LetterWord> }
  /**
   * L'élève écrit au doigt, sur le pointillé du tracé : la lettre isolée
   * (débutant) ou, si `form` est donné, sa forme liée (niveau avancé).
   */
  | { kind: "write"; letter: ArabicLetter; form?: LetterPosition }
  | { kind: "findLetter"; target: ArabicLetter; choices: ArabicLetter[] }
  /** Débutant, deuxième niveau : la lettre est montrée ; l'élève écoute trois sons et choisit le sien. */
  | { kind: "pickSound"; target: ArabicLetter; choices: ArabicLetter[] }
  /** Niveau avancé : reconnaître la lettre colorée dans un mot, sous sa forme liée. */
  | { kind: "findInWord"; word: LetterWord; target: ArabicLetter; choices: ArabicLetter[] }
  /**
   * Niveau avancé : le mot a un trou à la place de la lettre du jour ; l'élève
   * choisit, parmi ses formes début / milieu / fin, celle qui le complète.
   */
  | { kind: "completeWord"; letter: ArabicLetter; word: LetterWord; position: LetterPosition; choices: FormChoice[] }
  | { kind: "flashcard"; word: VocabWord; color: string }
  /** Animation d'un mot (vidéo muette en boucle), jouée après sa carte ; le commentaire est pour l'enseignant. */
  | { kind: "video"; src: string; caption: string; color: string }
  | { kind: "blur"; word: VocabWord; color: string }
  | { kind: "missing"; words: VocabWord[]; missingId: string; color: string }
  | { kind: "quiz"; target: VocabWord; choices: VocabWord[]; color: string }
  /** Quelle animation ? Deux ou trois clips côte à côte ; l'enseignant demande un geste, l'élève touche le bon clip. */
  | { kind: "clipQuiz"; target: ClipChoice; choices: ClipChoice[]; color: string }
  /** QCM d'une leçon d'enseignant, joué en direct : question et réponses telles qu'il les a rédigées. */
  | { kind: "qcm"; qcm: Qcm; color: string }
  /** Écran final : « أَحْسَنْتُمْ » et des confettis, à tous les niveaux. */
  | { kind: "bravo" };

/**
 * Mot d'une leçon de vocabulaire : son illustration (image de l'enseignant, à
 * défaut emoji) et, si l'enseignant l'a écrit, le mot lui-même. Une leçon
 * peut n'être faite que d'images : l'enseignant dit les mots.
 */
export interface VocabWord {
  id: string;
  /** Le mot tel que l'enseignant l'a écrit — en arabe le plus souvent. */
  arabic?: string;
  imageUrl?: string;
  emoji?: string;
  /** Animations du mot, jouées après sa carte. */
  clips?: Clip[];
  /** Rang fixe dans la présentation (mots animés) ; les mots sans rang sont tirés au sort après. */
  rank?: number;
}

/** Un clip proposé au jeu « quelle animation ? » : celui d'un mot présenté. */
export interface ClipChoice {
  /** Identifiant du mot, pour le décompte des réponses. */
  id: string;
  clip: Clip;
}

/**
 * Question à choix multiple d'une leçon d'enseignant. Sans question écrite,
 * l'enseignant la pose à voix haute ; si l'image de la bonne réponse est
 * connue, la question lui est proposée en arabe.
 */
export interface Qcm {
  id: string;
  question?: string;
  options: QcmOption[];
  correctId: string;
}

/** Réponse d'un QCM : son texte et/ou son image, selon le mode de réponse choisi par l'enseignant. */
export interface QcmOption {
  id: string;
  text?: string;
  imageUrl?: string;
  /** Mot arabe de l'image, quand elle est connue (voir data/imageWords). */
  word?: string;
}

/** Carte d'une forme liée de la lettre. */
export interface FormChoice {
  position: LetterPosition;
  glyph: string;
}

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

/**
 * La couleur d'une lettre dit comment elle se lie au milieu d'un mot : bleu
 * si elle s'attache des deux côtés, rose si elle ne s'attache qu'à la lettre
 * qui la précède (ا د ذ ر ز و).
 */
export function letterColor(letter: ArabicLetter): string {
  return letter.medial.endsWith("ـ") ? "#8BA3B1" : "#BB908E";
}

function inCharter(letter: ArabicLetter): ArabicLetter {
  return { ...letter, color: letterColor(letter) };
}

export const WORD_COUNTS = [4, 6, 8] as const;
/** En dessous, pas de « Qu'est-ce qui a disparu ? » ni de quiz à quatre images. */
export const MIN_VOCAB_WORDS = 4;
/** Au-delà, le texte d'une diapositive est une phrase, pas un mot à apprendre. */
export const MAX_WORD_LENGTH = 24;
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
    case "forms": return 3;
    // Une carte sans mot écrit ne se retourne pas.
    case "flashcard": return slide.word.arabic ? 1 : 0;
    case "blur": return 3;
    case "missing": return 2;
    default: return 0;
  }
}

/**
 * Question que l'enseignant pose à voix haute pendant un jeu. Elle n'est
 * affichée que sur son écran : à l'élève, elle donnerait la réponse. Pour un
 * QCM, c'est la question que l'enseignant a écrite dans la leçon, telle quelle.
 */
export function teacherQuestion(slide: Slide): string | null {
  switch (slide.kind) {
    case "qcm": return slide.qcm.question ?? qcmImageQuestion(slide.qcm);
    // La lettre à demander est montrée par son tracé, pas par son nom.
    case "findLetter": return `أَيْنَ هَذَا الْحَرْفُ : «${slide.target.isolated}»؟`;
    case "pickSound": return "مَا صَوْتُ هَذَا الْحَرْفِ؟";
    case "findInWord": return "مَا اسْمُ الْحَرْفِ الْمُلَوَّنِ؟";
    case "completeWord": return "أَيُّ شَكْلٍ يُكْمِلُ الْكَلِمَةَ؟";
    // Quiz en images de fin de leçon : le mot demandé est lu à voix haute.
    case "quiz": return `أَيْنَ صُورَةُ «${slide.target.arabic}»؟`;
    case "clipQuiz": return slide.target.clip.question;
    default: return null;
  }
}

/**
 * Consigne du quiz en images, affichée sous la question sur l'écran de
 * l'enseignant seulement. Les autres jeux n'en ont pas : seule la question
 * à poser, en arabe, est rappelée.
 */
export function teacherInstruction(slide: Slide): string | null {
  return slide.kind === "quiz" ? "Posez la question : les élèves touchent l'image du mot." : null;
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

function pickSoundSlide(target: ArabicLetter, pool: ArabicLetter[], rng: Rng): Slide {
  return { kind: "pickSound", target, choices: pickChoices(target, pool, rng) };
}

/** Mot d'exercice tiré au sort : celui de la présentation ou l'un des supplémentaires. */
function pickWord(letter: ArabicLetter, position: LetterPosition, rng: Rng): LetterWord {
  const words = exerciseWords(letter.id, position);
  return words[Math.floor(rng() * words.length)];
}

/** Un mot de la lettre (position tirée au sort) ; l'élève nomme la lettre colorée. */
function findInWordSlide(target: ArabicLetter, pool: ArabicLetter[], rng: Rng): Slide {
  const position = LETTER_POSITIONS[Math.floor(rng() * LETTER_POSITIONS.length)];
  return { kind: "findInWord", word: pickWord(target, position, rng), target, choices: pickChoices(target, pool, rng) };
}

/**
 * Les formes de la lettre, une carte par tracé distinct : les lettres qui ne
 * s'attachent que d'un côté (ا د ذ ر ز و) s'écrivent pareil au milieu et à la
 * fin, et n'ont donc que deux cartes.
 */
function formChoices(letter: ArabicLetter, rng: Rng): FormChoice[] {
  const seen = new Set<string>();
  const distinct = LETTER_POSITIONS
    .map((position) => ({ position, glyph: letter[position] }))
    .filter(({ glyph }) => !seen.has(glyph) && seen.add(glyph));
  return shuffle(distinct, rng);
}

/**
 * Formes à écrire, sans doublon de tracé : ا د ذ ر ز و s'écrivent pareil au
 * milieu et à la fin, et n'ont donc que deux exercices.
 */
export function writingForms(letter: ArabicLetter): LetterPosition[] {
  const seen = new Set<string>();
  return LETTER_POSITIONS.filter((form) => !seen.has(letter[form]) && seen.add(letter[form]));
}

/** Tracé que l'élève écrit sur une diapositive d'écriture. */
export function writingGlyph(slide: Extract<Slide, { kind: "write" }>): string {
  return slide.form ? slide.letter[slide.form] : slide.letter.isolated;
}

/** Bonne carte d'une manche « compléter le mot » : celle du tracé attendu. */
export function isRightForm(slide: Extract<Slide, { kind: "completeWord" }>, choice: FormChoice): boolean {
  return choice.glyph === slide.letter[slide.position];
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
    deck.push({ kind: "letter", letter });
    if (advanced) {
      deck.push({ kind: "forms", letter, words: LETTER_WORDS[letter.id] });
    }
  }

  const review = ARABIC_ALPHABET
    .filter((l) => reviewIds.includes(l.id) && !letterIds.includes(l.id))
    .slice(0, MAX_REVIEW_LETTERS)
    .map(inCharter);

  // Exercices, une fois la présentation terminée. Le débutant commence par
  // écrire chaque lettre du jour, isolée, sur son pointillé.
  if (!advanced) {
    for (const letter of letters) deck.push({ kind: "write", letter });
  }

  // Les jeux suivent le niveau de la séance : lettre isolée pour le débutant,
  // lettre à reconnaître dans un mot pour le niveau avancé.
  const round = advanced ? findInWordSlide : findLetterSlide;

  // Puis les lettres du jour, dans le désordre. Débutant : à retrouver d'abord
  // parmi elles, à défaut parmi les révisées. Avancé : trois mots à compléter,
  // un par position de la lettre, dans le désordre.
  for (const letter of shuffle(letters, rng)) {
    if (advanced) {
      for (const position of shuffle(LETTER_POSITIONS, rng)) {
        deck.push({ kind: "completeWord", letter, word: pickWord(letter, position, rng), position, choices: formChoices(letter, rng) });
      }
    } else {
      deck.push(findLetterSlide(letter, [...shuffle(letters, rng), ...shuffle(review, rng)], rng));
    }
  }

  // Débutant, deuxième niveau : le chemin inverse. Chaque lettre du jour est
  // montrée, dans un nouvel ordre, et l'élève choisit son son parmi trois.
  if (!advanced) {
    for (const letter of shuffle(letters, rng)) {
      deck.push(pickSoundSlide(letter, [...shuffle(letters, rng), ...shuffle(review, rng)], rng));
    }
  }

  // Révision choisie par l'enseignant, en clôture : rappel des lettres une à
  // une, puis une manche par lettre, parmi les révisées puis celles du jour.
  if (review.length > 0) {
    deck.push({ kind: "lettersTitle", letters: review });
    for (const target of shuffle(review, rng)) {
      deck.push(round(target, [...shuffle(review, rng), ...shuffle(letters, rng)], rng));
    }
    if (!advanced) {
      for (const target of shuffle(review, rng)) {
        deck.push(pickSoundSlide(target, [...shuffle(review, rng), ...shuffle(letters, rng)], rng));
      }
    }
  }

  // Niveau avancé, en clôture : écrire la lettre du jour sous chacune de ses
  // formes liées — début, milieu, fin.
  if (advanced) {
    for (const letter of letters) {
      for (const form of writingForms(letter)) deck.push({ kind: "write", letter, form });
    }
  }

  deck.push({ kind: "bravo" });
  return deck;
}

/**
 * Mots d'une leçon créée par un enseignant : les diapositives illustrées de
 * ses « leçons illustrées », avec le mot si elle en porte un. Les images sont
 * des URLs publiques ; une image encore embarquée (data:) serait trop lourde
 * pour la diffusion en direct et est écartée, comme les diapositives dont le
 * texte, trop long, est une phrase et non un mot. Un même mot, ou une même
 * image sans mot, n'est retenu qu'une fois.
 */
export function lessonVocabWords(blocks: readonly unknown[]): VocabWord[] {
  const words: VocabWord[] = [];
  const seen = new Set<string>();
  for (const block of blocks as { type?: string; slides?: { id?: string; imageDataUrl?: string; text?: string }[] }[]) {
    if (block?.type !== "slideshow") continue;
    for (const slide of block.slides ?? []) {
      const text = slide.text?.trim() ?? "";
      const imageUrl = publicUrl(slide.imageDataUrl);
      if (!imageUrl || text.length > MAX_WORD_LENGTH) continue;
      const key = text || imageUrl;
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({ id: slide.id ?? `mot-${words.length}`, ...(text && { arabic: text }), imageUrl });
    }
  }
  return words;
}

/** Un média n'est diffusable en direct que par une URL publique : une image ou un son encore embarqué (data:) serait trop lourd. */
function publicUrl(url: string | undefined): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

/** Le titre d'une leçon n'est écrit à l'écran que s'il est en arabe (aucun texte français). */
function arabicTitle(title: string): string | undefined {
  return /[\u0600-\u06FF]/.test(title) ? title : undefined;
}

/** Bloc « exercice » d'une leçon d'enseignant, réduit à ce qu'un QCM en direct utilise. */
interface RawQuizBlock {
  id?: string;
  type?: string;
  exercise?: {
    type?: string;
    question?: string;
    answerMode?: "image" | "text" | "both";
    options?: { id?: string; text?: string; imageDataUrl?: string }[];
    correctId?: string;
  };
}

/**
 * QCM d'une leçon créée par un enseignant : ses « quiz à choix multiple »,
 * dans l'ordre de la leçon. Chaque réponse ne garde que ce que le mode de
 * réponse affiche (image, texte ou les deux). Un QCM est laissé de côté si
 * une réponse resterait vide ou si la bonne réponse n'est pas parmi elles.
 */
export function lessonQcms(blocks: readonly unknown[], wordFor: (imageUrl: string | undefined) => string | undefined = () => undefined): Qcm[] {
  const qcms: Qcm[] = [];
  for (const block of blocks as RawQuizBlock[]) {
    const quiz = block?.exercise;
    if (block?.type !== "exercise" || quiz?.type !== "quiz") continue;
    const mode = quiz.answerMode ?? "image";
    const options = (quiz.options ?? []).map((raw, i): QcmOption => {
      const text = mode === "image" ? undefined : raw.text?.trim() || undefined;
      const imageUrl = mode === "text" ? undefined : publicUrl(raw.imageDataUrl);
      const word = wordFor(imageUrl);
      return { id: raw.id ?? `r${i}`, ...(text && { text }), ...(imageUrl && { imageUrl }), ...(word && { word }) };
    });
    const question = quiz.question?.trim() ?? "";
    const correctId = quiz.correctId ?? "";
    const playable = options.length >= 2 && options.every((o) => o.text || o.imageUrl) && options.some((o) => o.id === correctId);
    if (!playable) continue;
    qcms.push({ id: block.id ?? `qcm-${qcms.length}`, ...(question && { question }), options, correctId });
  }
  return qcms;
}

/** Sans question écrite : « أَيْنَ … ؟ » avec le mot de l'image de la bonne réponse, s'il est connu. */
function qcmImageQuestion(qcm: Qcm): string | null {
  const word = qcm.options.find((o) => o.id === qcm.correctId)?.word;
  return word ? `أَيْنَ ${word}؟` : null;
}

/**
 * Repère pour l'enseignant : la bonne réponse, par son texte ou, si elle
 * n'est qu'une image, par son rang parmi les réponses.
 */
export function qcmAnswerLabel(qcm: Qcm): string {
  const index = qcm.options.findIndex((o) => o.id === qcm.correctId);
  return qcm.options[index]?.text ?? `image n°${index + 1}`;
}

/**
 * Leçon de vocabulaire : les images d'une leçon d'enseignant. La première,
 * telle que l'enseignant l'a placée, ouvre toujours la séance (une vue
 * d'ensemble : le panier de fruits) ; viennent ensuite les mots à rang fixe
 * (les animés, dans l'ordre de leur registre), puis les autres tirés au sort.
 * Avec assez d'images viennent les devinettes (flou, disparition). Le quiz
 * final reprend les QCM de la leçon, dans son ordre ; sans QCM, un quiz en
 * images est tiré des mots présentés qui ont une écriture. La séance se
 * termine, dès deux mots animés, par « quelle animation ? » : jusqu'à trois
 * tours où l'élève touche, parmi deux ou trois clips, le geste demandé.
 */
export function buildVocabDeck(
  title: string,
  allWords: readonly VocabWord[],
  wordCount: number,
  qcms: readonly Qcm[] = [],
  color: string = charterColor(0),
  rng: Rng = Math.random,
): Slide[] {
  if (allWords.length < MIN_VOCAB_WORDS && qcms.length === 0) return [];

  const [cover, ...rest] = allWords;
  const ranked = rest.filter((w) => w.rank !== undefined).sort((a, b) => a.rank! - b.rank!);
  const others = shuffle(rest.filter((w) => w.rank === undefined), rng);
  const words = cover ? [cover, ...ranked, ...others].slice(0, wordCount) : [];
  // Écran d'accueil pendant que les élèves se connectent : le titre de la leçon
  // n'y est écrit que s'il est en arabe (aucun texte français à l'écran).
  const deck: Slide[] = [
    { kind: "title", title, arabic: arabicTitle(title), color },
    ...words.flatMap((word): Slide[] => [
      { kind: "flashcard", word, color },
      ...(word.clips ?? []).map((clip): Slide => ({ kind: "video", src: clip.src, caption: clip.caption, color })),
    ]),
  ];

  if (words.length >= MIN_VOCAB_WORDS) {
    for (const word of shuffle(words, rng).slice(0, 2)) {
      deck.push({ kind: "blur", word, color });
    }
    const shown = shuffle(words, rng).slice(0, 4);
    deck.push({ kind: "missing", words: shown, missingId: shown[Math.floor(rng() * shown.length)].id, color });
  }

  if (qcms.length > 0) {
    for (const qcm of qcms) deck.push({ kind: "qcm", qcm, color });
  } else if (words.length >= MIN_VOCAB_WORDS) {
    // Le mot à retrouver est écrit : seuls les mots qui en ont un peuvent être demandés.
    for (const target of shuffle(words.filter((w) => w.arabic), rng).slice(0, 3)) {
      const others = shuffle(words.filter((w) => w.id !== target.id), rng).slice(0, 3);
      deck.push({ kind: "quiz", target, choices: shuffle([target, ...others], rng), color });
    }
  }

  // En dernier, « quelle animation ? » : l'élève retrouve le geste demandé parmi les clips.
  const animated = words.filter((w) => w.clips?.length);
  if (animated.length >= 2) {
    for (const target of shuffle(animated, rng).slice(0, 3)) {
      const others = shuffle(animated.filter((w) => w.id !== target.id), rng).slice(0, 2);
      const choice = (w: VocabWord): ClipChoice => ({ id: w.id, clip: w.clips![0] });
      deck.push({ kind: "clipQuiz", target: choice(target), choices: shuffle([target, ...others], rng).map(choice), color });
    }
  }

  deck.push({ kind: "bravo" });
  return deck;
}

/**
 * Séance en plusieurs parties (des lettres puis une leçon de vocabulaire, ou
 * l'inverse) : les decks à la suite, avec un seul « bravo », celui de la
 * dernière partie. Une partie vide est ignorée.
 */
export function combineDecks(decks: readonly (readonly Slide[])[]): Slide[] {
  const parts = decks.filter((deck) => deck.length > 0);
  return parts.flatMap((deck, i) => (i < parts.length - 1 ? deck.filter((slide) => slide.kind !== "bravo") : [...deck]));
}

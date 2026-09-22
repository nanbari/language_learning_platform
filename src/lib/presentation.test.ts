import { describe, it, expect } from "vitest";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LETTER_STROKES } from "@/data/letterStrokes";
import { LETTER_FORM_STROKES } from "@/data/letterFormStrokes";
import { LETTER_POSITIONS, exerciseWords } from "@/data/letterWords";
import { buildLetterDeck, buildVocabDeck, combineDecks, isRightForm, lessonQcms, lessonVocabWords, letterColor, qcmAnswerLabel, shuffle, stepsFor, lettersPerLesson, teacherInstruction, teacherQuestion, writingGlyph, CHARTER_COLORS, type Qcm, type VocabWord } from "./presentation";

/** Générateur déterministe pour des decks reproductibles. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe("shuffle", () => {
  it("conserve les éléments sans modifier l'original", () => {
    const items = [1, 2, 3, 4, 5];
    const out = shuffle(items, seeded());
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("buildLetterDeck", () => {
  const LESSON = [4, 5, 6];
  // Manches de jeu : lettre isolée (débutant) ou lettre dans un mot (avancé).
  const rounds = (deck: ReturnType<typeof buildLetterDeck>) =>
    deck.flatMap((s) => (s.kind === "findLetter" || s.kind === "findInWord" ? [s] : []));

  it("commence par le titre et finit par le bravo", () => {
    const deck = buildLetterDeck(LESSON, "advanced", [], seeded());
    expect(deck[0].kind).toBe("lettersTitle");
    expect(deck.at(-1)?.kind).toBe("bravo");
  });

  it("dévoile les lettres du titre une à une", () => {
    const title = buildLetterDeck(LESSON, "beginner", [], seeded())[0];
    expect(stepsFor(title)).toBe(2);
    expect(stepsFor(buildLetterDeck([4], "beginner", [], seeded())[0])).toBe(0);
  });

  it("présente les trois lettres dans l'ordre de l'alphabet", () => {
    const deck = buildLetterDeck([6, 4, 5], "beginner", [], seeded());
    expect(deck.flatMap((s) => (s.kind === "letter" ? [s.letter.id] : []))).toEqual(LESSON);
  });

  it("place tous les exercices après la présentation des lettres", () => {
    for (const [level, game] of [["beginner", "findLetter"], ["advanced", "completeWord"]] as const) {
      const kinds = buildLetterDeck(LESSON, level, [], seeded()).map((s) => s.kind);
      const firstGame = kinds.indexOf(game);
      expect(firstGame).toBeGreaterThan(0);
      expect(kinds.slice(firstGame, -1).every((k) => k === game || k === "pickSound" || k === "write")).toBe(true);
    }
  });

  it("fait chercher chacune des lettres du jour", () => {
    const targets = rounds(buildLetterDeck(LESSON, "beginner", [], seeded())).map((r) => r.target.id);
    expect([...targets.slice(0, 3)].sort()).toEqual(LESSON);
  });

  it("place en fin de séance les lettres à réviser choisies par l'enseignant", () => {
    const deck = buildLetterDeck(LESSON, "beginner", [1, 2, 5], seeded());
    const kinds = deck.map((s) => s.kind);
    const recap = kinds.lastIndexOf("lettersTitle");
    expect(recap).toBeGreaterThan(kinds.indexOf("findLetter"));
    const recapSlide = deck[recap];
    // La lettre 5 appartient déjà à la leçon : elle n'est pas révisée.
    if (recapSlide.kind === "lettersTitle") expect(recapSlide.letters.map((l) => l.id)).toEqual([1, 2]);

    const reviewRounds = rounds(deck.slice(recap));
    expect(reviewRounds.map((r) => r.target.id).sort()).toEqual([1, 2]);
    for (const round of reviewRounds) {
      const ids = round.choices.map((l) => l.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toEqual(expect.arrayContaining([1, 2]));
    }
    expect(deck.at(-1)?.kind).toBe("bravo");
  });

  it("fait écrire chaque lettre du jour une fois, en pointillé, avant les jeux", () => {
    const deck = buildLetterDeck(LESSON, "beginner", [1], seeded());
    const writes = deck.flatMap((s) => (s.kind === "write" ? [s.letter.id] : []));
    expect(writes).toEqual([4, 5, 6]);

    const kinds = deck.map((s) => s.kind);
    expect(kinds.lastIndexOf("letter")).toBeLessThan(kinds.indexOf("write"));
    expect(kinds.lastIndexOf("write")).toBeLessThan(kinds.indexOf("findLetter"));
  });

  it("étudie trois lettres au niveau débutant, une seule au niveau avancé", () => {
    expect(lettersPerLesson("beginner")).toBe(3);
    expect(lettersPerLesson("advanced")).toBe(1);
  });

  it("propose toujours trois cartes pour une leçon d'une seule lettre", () => {
    const alone = rounds(buildLetterDeck([7], "beginner", [], seeded(3)));
    expect(alone).toHaveLength(1);
    expect(new Set(alone[0].choices.map((l) => l.id)).size).toBe(3);
    expect(alone[0].choices.map((l) => l.id)).toContain(7);

    // Avec des lettres à réviser, ce sont elles qui complètent les cartes.
    const withReview = rounds(buildLetterDeck([7], "beginner", [1, 2], seeded(3)));
    expect(withReview[0].target.id).toBe(7);
    expect(withReview[0].choices.map((l) => l.id).sort()).toEqual([1, 2, 7]);
  });

  it("fait compléter au niveau avancé trois mots, un par position de la lettre du jour", () => {
    for (const letter of ARABIC_ALPHABET) {
      const deck = buildLetterDeck([letter.id], "advanced", [], seeded(letter.id));
      const games = deck.flatMap((s) => (s.kind === "completeWord" ? [s] : []));
      expect(games.map((g) => g.position).sort()).toEqual(["final", "initial", "medial"]);
      for (const game of games) {
        expect(exerciseWords(letter.id, game.position)).toContainEqual(game.word);
        // Une seule bonne carte, et jamais deux cartes au même tracé.
        expect(game.choices.filter((c) => isRightForm(game, c))).toHaveLength(1);
        expect(new Set(game.choices.map((c) => c.glyph)).size).toBe(game.choices.length);
        expect(game.choices).toHaveLength(letterColor(letter) === "#BB908E" ? 2 : 3);
      }
    }
  });

  it("fait réviser au niveau de la séance : dans un mot pour le niveau avancé", () => {
    const advanced = buildLetterDeck([7], "advanced", [1, 2], seeded());
    const inWord = advanced.flatMap((s) => (s.kind === "findInWord" ? [s] : []));
    expect(inWord.map((s) => s.target.id).sort()).toEqual([1, 2]);
    for (const slide of inWord) {
      expect(LETTER_POSITIONS.flatMap((p) => exerciseWords(slide.target.id, p))).toContainEqual(slide.word);
      expect(slide.choices.map((l) => l.id).sort()).toEqual([1, 2, 7]);
    }
    // Plus aucune manche « lettre isolée » au niveau avancé.
    expect(advanced.some((s) => s.kind === "findLetter")).toBe(false);

    const beginner = buildLetterDeck(LESSON, "beginner", [1, 2], seeded());
    expect(beginner.some((s) => s.kind === "findInWord")).toBe(false);
  });

  it("ajoute au débutant un deuxième niveau : choisir le son de la lettre montrée", () => {
    const deck = buildLetterDeck(LESSON, "beginner", [1, 2], seeded());
    const kinds = deck.map((s) => s.kind);
    const sounds = deck.flatMap((s) => (s.kind === "pickSound" ? [s] : []));
    const said = sounds.map((s) => s.target.id);
    for (const round of sounds) {
      const ids = round.choices.map((l) => l.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toContain(round.target.id);
    }
    // Les lettres du jour d'abord, puis les révisées, chacune après ses manches de cartes.
    expect([...said.slice(0, 3)].sort()).toEqual(LESSON);
    expect([...said.slice(3)].sort()).toEqual([1, 2]);
    expect(kinds.indexOf("pickSound")).toBeGreaterThan(kinds.indexOf("findLetter"));
    expect(kinds.lastIndexOf("pickSound")).toBeGreaterThan(kinds.lastIndexOf("findLetter"));

    const advanced = buildLetterDeck([7], "advanced", [1], seeded());
    expect(advanced.some((s) => s.kind === "pickSound")).toBe(false);
  });

  it("fait écrire au niveau avancé les formes liées, en fin de séance, jamais la lettre isolée", () => {
    for (const letter of ARABIC_ALPHABET) {
      const deck = buildLetterDeck([letter.id], "advanced", [1, 2], seeded(letter.id));
      const writes = deck.flatMap((s) => (s.kind === "write" ? [s] : []));
      const oneSided = letterColor(letter) === "#BB908E";
      expect(writes.map((w) => w.form)).toEqual(oneSided ? ["initial", "medial"] : ["initial", "medial", "final"]);
      // Chaque tracé demandé a son geste d'écriture.
      for (const w of writes) {
        const glyph = writingGlyph(w);
        expect(LETTER_STROKES[glyph] ?? LETTER_FORM_STROKES[glyph]).toBeDefined();
      }
      // Dernières diapositives avant le bravo.
      const kinds = deck.map((s) => s.kind);
      expect(kinds.slice(-1 - writes.length, -1).every((k) => k === "write")).toBe(true);
    }
  });

  it("n'ajoute rien sans lettre à réviser", () => {
    const kinds = buildLetterDeck(LESSON, "beginner", [], seeded()).map((s) => s.kind);
    expect(kinds.filter((k) => k === "lettersTitle")).toHaveLength(1);
  });

  it("ne propose que les trois lettres de la leçon", () => {
    const all = rounds(buildLetterDeck(LESSON, "beginner", [], seeded(7)));
    expect(all).toHaveLength(3);
    for (const round of all) {
      expect(round.choices.map((l) => l.id).sort()).toEqual(LESSON);
      expect(LESSON).toContain(round.target.id);
    }
  });

  it("n'emploie que les couleurs de la charte graphique", () => {
    const charter: readonly string[] = CHARTER_COLORS;
    for (const slide of buildLetterDeck(LESSON, "advanced", [], seeded())) {
      if (slide.kind === "letter") expect(charter).toContain(slide.letter.color);
      if (slide.kind === "findLetter") for (const l of slide.choices) expect(charter).toContain(l.color);
    }
    for (const slide of buildVocabDeck("Les animaux", WORDS, 4, [], CHARTER_COLORS[1], seeded())) {
      if ("color" in slide) expect(charter).toContain(slide.color);
    }
  });

  it("colore en rose les lettres qui ne s'attachent que d'un côté, en bleu les autres", () => {
    const rose = ARABIC_ALPHABET.filter((l) => letterColor(l) === "#BB908E").map((l) => l.isolated);
    expect(rose).toEqual(["ا", "د", "ذ", "ر", "ز", "و"]);
    expect(ARABIC_ALPHABET.filter((l) => letterColor(l) === "#8BA3B1")).toHaveLength(22);
  });

  it("donne à l'enseignant la question à poser pour les jeux de lettres seulement", () => {
    const deck = buildLetterDeck([2], "advanced", [1], seeded());
    for (const slide of deck) {
      const question = teacherQuestion(slide);
      if (slide.kind === "findLetter") {
        expect(question).toContain(slide.target.isolated);
        expect(question).not.toContain(slide.target.name);
      }
      else if (slide.kind === "findInWord" || slide.kind === "completeWord") expect(question).toBeTruthy();
      else if (slide.kind === "pickSound") expect(question).toBeTruthy();
      else expect(question).toBeNull();
    }
  });

  it("n'écrit le nom des lettres à aucun niveau", () => {
    for (const level of ["beginner", "advanced"] as const) {
      const deck = buildLetterDeck([2], level, [1], seeded());
      const names = ARABIC_ALPHABET.flatMap((l) => [l.name, l.nameTranslit]);
      for (const name of names) expect(JSON.stringify(deck.map((s) => [stepsFor(s), teacherQuestion(s)]))).not.toContain(name);
      for (const slide of deck) if (slide.kind === "letter") expect(stepsFor(slide)).toBe(0);
    }
  });

  it("épargne au débutant les formes liées et tout mot écrit en arabe", () => {
    const deck = buildLetterDeck(LESSON, "beginner", [], seeded());
    expect(deck.some((s) => s.kind === "forms")).toBe(false);
    expect(deck.at(-1)).toEqual({ kind: "bravo", plain: true });
  });

  it("montre au niveau avancé les formes, chacune avec son mot, sur une seule diapositive", () => {
    const deck = buildLetterDeck([2], "advanced", [], seeded());
    const forms = deck.flatMap((s) => (s.kind === "forms" ? [s] : []));
    expect(forms).toHaveLength(1);
    expect(forms[0].words.initial.text).toBe("[بَ]طَّة");
    expect(forms[0].words.medial.text).toBe("جَ[بَ]ل");
    expect(forms[0].words.final.text).toBe("كَلْ[ب]");
    // La diapositive des formes suit directement celle de la lettre.
    const kinds = deck.map((s) => s.kind);
    expect(kinds[kinds.indexOf("letter") + 1]).toBe("forms");
    expect(kinds[kinds.indexOf("forms") + 1]).toBe("completeWord");
  });

  it("renvoie un deck vide sans lettre connue", () => {
    expect(buildLetterDeck([99], "beginner")).toEqual([]);
    expect(buildLetterDeck([], "beginner")).toEqual([]);
  });
});

const WORDS: VocabWord[] = ["قِطّ", "كَلْب", "فِيل", "أَسَد", "جَمَل", "حِصَان", "بَطَّة", "دُبّ"].map((arabic, i) => ({
  id: `w${i}`, arabic, imageUrl: `https://media.example.org/${i}.webp`,
}));

describe("buildVocabDeck", () => {
  it("présente une carte par mot choisi", () => {
    const deck = buildVocabDeck("Les animaux", WORDS, 6, [], undefined, seeded());
    expect(deck.filter((s) => s.kind === "flashcard")).toHaveLength(6);
  });

  it("ouvre toujours par la première image de la leçon, les autres tirées au sort", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const deck = buildVocabDeck("Les fruits", WORDS, 4, [], undefined, seeded(seed));
      const cards = deck.filter((s) => s.kind === "flashcard");
      expect(cards).toHaveLength(4);
      expect(cards[0].kind === "flashcard" && cards[0].word.id).toBe(WORDS[0].id);
    }
    const orders = [1, 2, 3].map((seed) => buildVocabDeck("Les fruits", WORDS, 6, [], undefined, seeded(seed)).flatMap((s) => (s.kind === "flashcard" ? [s.word.id] : [])).join());
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("place les mots à rang fixe juste après la première image, dans leur ordre, puis les autres", () => {
    // Rangs donnés à rebours de l'ordre de la leçon : c'est le rang qui compte.
    const words = WORDS.map((w, i) => ([5, 3, 1].includes(i) ? { ...w, rank: 5 - i } : w));
    for (const seed of [1, 2, 3]) {
      const ids = buildVocabDeck("Les fruits", words, 6, [], undefined, seeded(seed)).flatMap((s) => (s.kind === "flashcard" ? [s.word.id] : []));
      expect(ids.slice(0, 4)).toEqual([WORDS[0].id, WORDS[5].id, WORDS[3].id, WORDS[1].id]);
      expect(ids).toHaveLength(6);
    }
  });

  it("joue les animations d'un mot juste après sa carte, dans l'ordre", () => {
    const clips = [{ src: "/animations/fruits/pomme-couper.mp4", caption: "On coupe la pomme" }, { src: "/animations/fruits/pomme-jus.mp4", caption: "On presse la pomme : du jus !" }];
    const words = WORDS.map((w, i) => (i === 2 ? { ...w, clips } : w));
    const deck = buildVocabDeck("Les fruits", words, 8, [], undefined, seeded());
    const kinds = deck.map((s) => s.kind);
    const at = deck.findIndex((s) => s.kind === "flashcard" && s.word.id === WORDS[2].id);
    expect(kinds.slice(at, at + 3)).toEqual(["flashcard", "video", "video"]);
    expect(deck.flatMap((s) => (s.kind === "video" ? [s.src] : []))).toEqual(clips.map((c) => c.src));
    expect(stepsFor(deck[at + 1])).toBe(0);
  });

  it("ne joue qu'avec les mots présentés", () => {
    const deck = buildVocabDeck("Les animaux", WORDS, 4, [], undefined, seeded(3));
    const shown = new Set(deck.flatMap((s) => (s.kind === "flashcard" ? [s.word.id] : [])));
    for (const slide of deck) {
      if (slide.kind === "blur") expect(shown).toContain(slide.word.id);
      if (slide.kind === "quiz") {
        expect(slide.choices.map((w) => w.id)).toContain(slide.target.id);
        for (const w of slide.choices) expect(shown).toContain(w.id);
      }
      if (slide.kind === "missing") {
        expect(slide.words.map((w) => w.id)).toContain(slide.missingId);
      }
    }
  });

  it("renvoie un deck vide pour une leçon de moins de quatre mots", () => {
    expect(buildVocabDeck("Trop courte", WORDS.slice(0, 3), 4)).toEqual([]);
  });

  it("n'écrit le titre de la leçon que s'il est en arabe", () => {
    const french = buildVocabDeck("Les animaux", WORDS, 4, [], undefined, seeded())[0];
    const arabic = buildVocabDeck("الحَيَوَانَات", WORDS, 4, [], undefined, seeded())[0];
    expect(french.kind === "title" && french.arabic).toBeUndefined();
    expect(arabic.kind === "title" && arabic.arabic).toBe("الحَيَوَانَات");
  });
});

describe("lessonVocabWords", () => {
  const img = (n: number) => `https://media.example.org/${n}.webp`;
  it("retient les diapositives qui portent une image publique, avec leur mot s'il est écrit", () => {
    const words = lessonVocabWords([
      { type: "video", url: "https://example.org/v" },
      { type: "slideshow", slides: [
        { id: "s1", imageDataUrl: img(1), text: " قِطّ " },
        { id: "s2", imageDataUrl: img(2) },                                   // sans mot : l'enseignant le dit
        { id: "s3", imageDataUrl: "", text: "كَلْب" },                          // sans image
        { id: "s4", imageDataUrl: "data:image/png;base64,AAAA", text: "فِيل" }, // image embarquée, trop lourde
        { id: "s5", imageDataUrl: img(5), text: "Le chat dort sur le canapé du salon." }, // une phrase
        { id: "s6", imageDataUrl: img(6), text: "قِطّ" },                       // doublon du mot
        { id: "s8", imageDataUrl: img(2) },                                   // doublon de l'image sans mot
      ] },
      { type: "exercise", exercise: { type: "quiz" } },
      { type: "slideshow", slides: [{ id: "s7", imageDataUrl: img(7), text: "chien" }] },
    ]);
    expect(words).toEqual([
      { id: "s1", arabic: "قِطّ", imageUrl: img(1) },
      { id: "s2", imageUrl: img(2) },
      { id: "s7", arabic: "chien", imageUrl: img(7) },
    ]);
  });
});

describe("lessonQcms", () => {
  const img = (n: number) => `https://media.example.org/${n}.webp`;
  const quiz = (id: string, exercise: object) => ({ id, type: "exercise", exercise: { type: "quiz", ...exercise } });

  it("retient les quiz à choix multiple, dans l'ordre de la leçon", () => {
    const qcms = lessonQcms([
      { type: "slideshow", slides: [{ id: "s1", imageDataUrl: img(1), text: "قِطّ" }] },
      quiz("q1", {
        question: " Où est le chat ? ", answerMode: "image", correctId: "a",
        options: [{ id: "a", text: "chat", imageDataUrl: img(1) }, { id: "b", text: "", imageDataUrl: img(2) }],
      }),
      { id: "m1", type: "exercise", exercise: { type: "matching", pairs: [] } },
      quiz("q2", {
        question: "مَا هَذَا؟", answerMode: "both", correctId: "d",
        options: [{ id: "c", text: "كَلْب", imageDataUrl: img(3) }, { id: "d", text: "قِطّ" }],
      }),
      quiz("q3", {
        question: "Quel mot ?", answerMode: "text", correctId: "f",
        options: [{ id: "e", text: "un", imageDataUrl: img(4) }, { id: "f", text: "deux" }, { id: "g", text: "trois" }],
      }),
    ]);
    expect(qcms).toEqual([
      { id: "q1", question: "Où est le chat ?", correctId: "a", options: [{ id: "a", imageUrl: img(1) }, { id: "b", imageUrl: img(2) }] },
      { id: "q2", question: "مَا هَذَا؟", correctId: "d", options: [{ id: "c", text: "كَلْب", imageUrl: img(3) }, { id: "d", text: "قِطّ" }] },
      { id: "q3", question: "Quel mot ?", correctId: "f", options: [{ id: "e", text: "un" }, { id: "f", text: "deux" }, { id: "g", text: "trois" }] },
    ]);
  });

  it("garde un quiz sans question écrite : l'enseignant la pose à voix haute", () => {
    const options = [{ id: "a", imageDataUrl: img(1) }, { id: "b", imageDataUrl: img(2) }];
    expect(lessonQcms([quiz("q1", { question: "", answerMode: "image", correctId: "a", options })])).toEqual([
      { id: "q1", correctId: "a", options: [{ id: "a", imageUrl: img(1) }, { id: "b", imageUrl: img(2) }] },
    ]);
  });

  it("écarte un quiz sans bonne réponse marquée ou dont une réponse serait vide", () => {
    const options = [{ id: "a", text: "un", imageDataUrl: img(1) }, { id: "b", text: "deux", imageDataUrl: img(2) }];
    expect(lessonQcms([
      quiz("q2", { question: "Sans réponse", answerMode: "text", correctId: "", options }),
      quiz("q3", { question: "Réponse inconnue", answerMode: "text", correctId: "z", options }),
      quiz("q4", { question: "Une seule réponse", answerMode: "text", correctId: "a", options: options.slice(0, 1) }),
      // Mode image : la seconde image, encore embarquée (data:), laisserait sa carte vide.
      quiz("q5", { question: "Image embarquée", answerMode: "image", correctId: "a",
        options: [options[0], { id: "b", text: "deux", imageDataUrl: "data:image/png;base64,AAAA" }] }),
      // Mode texte : la même image embarquée n'est pas affichée, le quiz reste jouable.
      quiz("q6", { question: "Texte seul", answerMode: "text", correctId: "a",
        options: [options[0], { id: "b", text: "deux", imageDataUrl: "data:image/png;base64,AAAA" }] }),
    ]).map((q) => q.id)).toEqual(["q6"]);
  });

});

/** Leçon faite d'images seulement, comme « Les fruits » : aucun mot écrit. */
const PICTURES: VocabWord[] = WORDS.map(({ id, imageUrl }) => ({ id, imageUrl }));

const QCMS: Qcm[] = [
  { id: "q1", question: "Où est le chat ?", correctId: "b", options: [{ id: "a", imageUrl: "https://media.example.org/1.webp" }, { id: "b", imageUrl: "https://media.example.org/2.webp" }] },
  { id: "q2", question: "مَا هَذَا؟", correctId: "c", options: [{ id: "c", text: "قِطّ" }, { id: "d", text: "كَلْب" }] },
];

describe("buildVocabDeck avec les QCM de la leçon", () => {
  it("joue les QCM de la leçon, dans son ordre, à la place du quiz en images", () => {
    const deck = buildVocabDeck("Les animaux", WORDS, 4, QCMS, CHARTER_COLORS[2], seeded());
    expect(deck.filter((s) => s.kind === "quiz")).toHaveLength(0);
    expect(deck.flatMap((s) => (s.kind === "qcm" ? [s.qcm.id] : []))).toEqual(["q1", "q2"]);
    // Les QCM viennent après la présentation et les devinettes, juste avant le bravo.
    expect(deck.slice(-3).map((s) => s.kind)).toEqual(["qcm", "qcm", "bravo"]);
    for (const slide of deck) if ("color" in slide) expect(slide.color).toBe(CHARTER_COLORS[2]);
  });

  it("revient au quiz en images quand la leçon n'a pas de QCM", () => {
    const deck = buildVocabDeck("Les animaux", WORDS, 4, [], undefined, seeded());
    expect(deck.filter((s) => s.kind === "quiz")).toHaveLength(3);
    expect(deck.filter((s) => s.kind === "qcm")).toHaveLength(0);
  });

  it("présente une leçon d'images sans mot : cartes sans retournement, devinettes, puis les QCM", () => {
    const deck = buildVocabDeck("Les fruits", PICTURES, 6, QCMS, undefined, seeded());
    const cards = deck.filter((s) => s.kind === "flashcard");
    expect(cards).toHaveLength(6);
    for (const card of cards) expect(stepsFor(card)).toBe(0);
    expect(deck.filter((s) => s.kind === "blur")).toHaveLength(2);
    expect(deck.filter((s) => s.kind === "missing")).toHaveLength(1);
    expect(deck.filter((s) => s.kind === "qcm")).toHaveLength(2);
  });

  it("sans QCM, ne demande en quiz que des mots écrits", () => {
    const deck = buildVocabDeck("Les fruits", PICTURES, 6, [], undefined, seeded());
    expect(deck.filter((s) => s.kind === "quiz")).toHaveLength(0);
    const mixed = [...PICTURES.slice(0, 5), WORDS[5]];
    const quiz = buildVocabDeck("Mixte", mixed, 6, [], undefined, seeded()).filter((s) => s.kind === "quiz");
    expect(quiz).toHaveLength(1);
    expect(quiz[0].kind === "quiz" && quiz[0].target.id).toBe(WORDS[5].id);
  });

  it("présente une leçon de moins de quatre images si elle a un QCM : cartes et QCM, sans devinettes", () => {
    const deck = buildVocabDeck("Courte", PICTURES.slice(0, 2), 4, QCMS.slice(0, 1), undefined, seeded());
    expect(deck.map((s) => s.kind)).toEqual(["title", "flashcard", "flashcard", "qcm", "bravo"]);
    expect(buildVocabDeck("Courte sans QCM", PICTURES.slice(0, 2), 4, [], undefined, seeded())).toEqual([]);
  });

  it("donne à l'enseignant la question exacte du quiz en images, avec le mot demandé", () => {
    const question = teacherQuestion({ kind: "quiz", target: WORDS[0], choices: WORDS.slice(0, 4), color: "" });
    expect(question).toBe(`أَيْنَ صُورَةُ «${WORDS[0].arabic}»؟`);
  });

  it("rappelle à l'enseignant la question écrite du QCM, à poser à voix haute", () => {
    expect(teacherQuestion({ kind: "qcm", qcm: QCMS[0], color: "" })).toBe("Où est le chat ?");
    expect(teacherQuestion({ kind: "qcm", qcm: { ...QCMS[0], question: undefined }, color: "" })).toBeNull();
    expect(stepsFor({ kind: "qcm", qcm: QCMS[0], color: "" })).toBe(0);
  });
});

describe("combineDecks", () => {
  it("enchaîne lettres puis vocabulaire, ou l'inverse, avec un seul bravo à la fin", () => {
    const letters = buildLetterDeck([2], "beginner", [], seeded());
    const vocab = buildVocabDeck("Les fruits", WORDS, 4, [], undefined, seeded());
    for (const decks of [[letters, vocab], [vocab, letters]]) {
      const deck = combineDecks(decks);
      expect(deck).toHaveLength(letters.length + vocab.length - 1);
      expect(deck[0]).toEqual(decks[0][0]);
      expect(deck.filter((s) => s.kind === "bravo")).toHaveLength(1);
      expect(deck.at(-1)).toEqual(decks[1].at(-1));
    }
  });

  it("ignore une partie vide et rend un deck seul tel quel", () => {
    const vocab = buildVocabDeck("Les fruits", WORDS, 4, [], undefined, seeded());
    expect(combineDecks([[], vocab])).toEqual(vocab);
    expect(combineDecks([vocab])).toEqual(vocab);
  });
});

describe("teacherInstruction", () => {
  it("ne guide l'enseignant qu'au quiz en images : un QCM ne montre que sa question", () => {
    expect(teacherInstruction({ kind: "qcm", qcm: QCMS[0], color: "" })).toBeNull();
    expect(teacherInstruction({ kind: "quiz", target: WORDS[0], choices: WORDS.slice(0, 4), color: "" })).toMatch(/^Posez la question/);
    expect(teacherInstruction({ kind: "flashcard", word: WORDS[0], color: "" })).toBeNull();
  });
});

describe("qcmAnswerLabel", () => {
  it("rappelle la bonne réponse par son texte, ou par son rang si elle n'est qu'une image", () => {
    expect(qcmAnswerLabel(QCMS[0])).toBe("image n°2");
    expect(qcmAnswerLabel(QCMS[1])).toBe("قِطّ");
  });
});

describe("stepsFor", () => {
  it("laisse les jeux sans étapes", () => {
    const quiz = buildVocabDeck("Les animaux", WORDS, 4, [], undefined, seeded()).find((s) => s.kind === "quiz");
    expect(quiz && stepsFor(quiz)).toBe(0);
    expect(stepsFor({ kind: "bravo" })).toBe(0);
  });
});

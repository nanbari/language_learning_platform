import { describe, it, expect } from "vitest";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LETTER_STROKES } from "@/data/letterStrokes";
import { LETTER_FORM_STROKES } from "@/data/letterFormStrokes";
import { LETTER_POSITIONS, exerciseWords } from "@/data/letterWords";
import { buildLetterDeck, buildVocabDeck, isRightForm, letterColor, shuffle, stepsFor, lettersPerLesson, teacherQuestion, writingGlyph, CHARTER_COLORS } from "./presentation";

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
    for (const slide of buildVocabDeck("colors", 4, seeded())) {
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

describe("buildVocabDeck", () => {
  it("présente une carte par mot choisi", () => {
    const deck = buildVocabDeck("animals", 6, seeded());
    expect(deck.filter((s) => s.kind === "flashcard")).toHaveLength(6);
  });

  it("ne joue qu'avec les mots présentés", () => {
    const deck = buildVocabDeck("animals", 4, seeded(3));
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

  it("renvoie un deck vide pour un thème inconnu", () => {
    expect(buildVocabDeck("inconnu", 4)).toEqual([]);
  });
});

describe("stepsFor", () => {
  it("laisse les jeux sans étapes", () => {
    const quiz = buildVocabDeck("animals", 4, seeded()).find((s) => s.kind === "quiz");
    expect(quiz && stepsFor(quiz)).toBe(0);
    expect(stepsFor({ kind: "bravo" })).toBe(0);
  });
});

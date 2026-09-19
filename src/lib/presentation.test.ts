import { describe, it, expect } from "vitest";
import { buildLetterDeck, buildVocabDeck, shuffle, stepsFor, findWordEmoji, lettersPerLesson, CHARTER_COLORS } from "./presentation";

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
  const rounds = (deck: ReturnType<typeof buildLetterDeck>) => deck.flatMap((s) => (s.kind === "findLetter" ? [s] : []));

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
    for (const level of ["beginner", "advanced"] as const) {
      const kinds = buildLetterDeck(LESSON, level, [], seeded()).map((s) => s.kind);
      const firstGame = kinds.indexOf("findLetter");
      expect(kinds.slice(firstGame, -1).every((k) => k === "findLetter")).toBe(true);
      expect(kinds.slice(0, firstGame)).not.toContain("findLetter");
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

  it("étudie trois lettres au niveau débutant, une seule au niveau avancé", () => {
    expect(lettersPerLesson("beginner")).toBe(3);
    expect(lettersPerLesson("advanced")).toBe(1);
  });

  it("propose toujours trois cartes pour une leçon d'une seule lettre", () => {
    const alone = rounds(buildLetterDeck([7], "advanced", [], seeded(3)));
    expect(alone).toHaveLength(1);
    expect(new Set(alone[0].choices.map((l) => l.id)).size).toBe(3);
    expect(alone[0].choices.map((l) => l.id)).toContain(7);

    // Avec des lettres à réviser, ce sont elles qui complètent les cartes.
    const withReview = rounds(buildLetterDeck([7], "advanced", [1, 2], seeded(3)));
    expect(withReview[0].target.id).toBe(7);
    expect(withReview[0].choices.map((l) => l.id).sort()).toEqual([1, 2, 7]);
  });

  it("n'ajoute rien sans lettre à réviser", () => {
    const kinds = buildLetterDeck(LESSON, "beginner", [], seeded()).map((s) => s.kind);
    expect(kinds.filter((k) => k === "lettersTitle")).toHaveLength(1);
  });

  it("ne propose que les trois lettres de la leçon", () => {
    const all = rounds(buildLetterDeck(LESSON, "advanced", [], seeded(7)));
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

  it("épargne au débutant les formes liées et tout mot écrit en arabe", () => {
    const deck = buildLetterDeck(LESSON, "beginner", [], seeded());
    expect(deck.some((s) => s.kind === "forms" || s.kind === "example")).toBe(false);
    for (const slide of deck) {
      if (slide.kind === "letter") expect(slide.arabicName).toBe(false);
    }
    expect(deck.at(-1)).toEqual({ kind: "bravo", plain: true });
  });

  it("garde les formes et le mot-exemple de chaque lettre au niveau avancé", () => {
    const kinds = buildLetterDeck(LESSON, "advanced", [], seeded()).map((s) => s.kind);
    expect(kinds.filter((k) => k === "forms")).toHaveLength(3);
    expect(kinds.filter((k) => k === "example")).toHaveLength(3);
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

describe("findWordEmoji", () => {
  it("retrouve l'emoji d'un mot du vocabulaire", () => {
    expect(findWordEmoji("أَسَد")).toBe("🦁");
    expect(findWordEmoji("introuvable")).toBeNull();
  });
});

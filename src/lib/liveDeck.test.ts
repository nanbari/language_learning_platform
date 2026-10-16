import { describe, it, expect } from "vitest";
import { buildLessonDeck, lessonParts, type LettersBlock } from "./liveDeck";

/** Générateur déterministe pour des decks reproductibles. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const image = (n: number) => `https://media.example/${n}.jpg`;

function slideshow(urls: string[]) {
  return { id: "s", type: "slideshow", slides: urls.map((url, i) => ({ id: `m${i}`, imageDataUrl: url, text: `كَلِمَة${i}` })) };
}

const letters: LettersBlock = { id: "l", type: "letters", level: "beginner", letterIds: [2, 3, 4], reviewIds: [] };

describe("lessonParts", () => {
  it("suit l'ordre des blocs de la leçon", () => {
    const vocab = slideshow([image(1), image(2), image(3), image(4)]);
    expect(lessonParts("t", [letters, vocab], "#000").map((p) => p.kind)).toEqual(["letters", "vocab"]);
    expect(lessonParts("t", [vocab, letters], "#000").map((p) => p.kind)).toEqual(["vocab", "letters"]);
  });

  it("ignore un bloc « Lettres » incomplet et un vocabulaire trop court", () => {
    const incomplete = { ...letters, letterIds: [2] };
    expect(lessonParts("t", [incomplete, slideshow([image(1), image(2)])], "#000")).toEqual([]);
  });

  it("garde les images dans l'ordre de la leçon", () => {
    const [part] = lessonParts("t", [slideshow([image(1), image(4), image(2), image(5), image(3)])], "#000");
    expect(part.kind === "vocab" && part.words.map((w) => w.imageUrl)).toEqual([image(1), image(4), image(2), image(5), image(3)]);
  });
});

describe("diaporama", () => {
  const blocks = [letters, slideshow([image(1), image(4), image(2), image(5), image(3)])];
  const parts = lessonParts("الْفَوَاكِه", blocks, "#8BA3B1");

  it("montre les mots dans l'ordre fixe de la leçon", () => {
    const deck = buildLessonDeck(parts, seeded());
    const cards = deck.flatMap((s) => (s.kind === "flashcard" ? [s.word.imageUrl] : []));
    expect(cards).toEqual([image(1), image(4), image(2), image(5), image(3)]);
  });

  it("les lettres passent avant le vocabulaire, et un seul écran final", () => {
    const deck = buildLessonDeck(parts, seeded());
    const firstLetter = deck.findIndex((s) => s.kind === "letter");
    const firstCard = deck.findIndex((s) => s.kind === "flashcard");
    expect(firstLetter).toBeLessThan(firstCard);
    expect(deck.filter((s) => s.kind === "bravo")).toHaveLength(1);
  });
});

import { describe, it, expect } from "vitest";
import { IMAGE_CLIPS } from "@/data/animations";
import { buildLessonDeck, lessonParts, recapProps, type LettersBlock } from "./liveDeck";

/** Générateur déterministe pour des decks reproductibles. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const [POMME, ORANGE] = Object.keys(IMAGE_CLIPS);
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

  it("range les mots : la couverture, les mots animés dans leur ordre fixe, puis les autres", () => {
    const [part] = lessonParts("t", [slideshow([image(1), ORANGE, image(2), POMME, image(3)])], "#000");
    expect(part.kind === "vocab" && part.words.map((w) => w.imageUrl)).toEqual([image(1), POMME, ORANGE, image(2), image(3)]);
  });
});

describe("vidéo et diaporama", () => {
  const blocks = [letters, slideshow([image(1), ORANGE, image(2), POMME, image(3)])];
  const parts = lessonParts("الْفَوَاكِه", blocks, "#8BA3B1");

  it("montrent les mêmes mots, dans le même ordre", () => {
    const video = recapProps(parts).parts.find((p) => p.kind === "vocab");
    const deck = buildLessonDeck(parts, seeded());
    const cards = deck.flatMap((s) => (s.kind === "flashcard" ? [s.word.imageUrl] : []));
    expect(video?.kind === "vocab" && video.words.map((w) => w.imageUrl)).toEqual(cards);
  });

  it("montrent les mêmes lettres, dans le même ordre", () => {
    const video = recapProps(parts).parts.find((p) => p.kind === "letters");
    const deck = buildLessonDeck(parts, seeded());
    const traced = deck.flatMap((s) => (s.kind === "letter" ? [s.letter.isolated] : []));
    expect(video?.kind === "letters" && video.letters.map((l) => l.char)).toEqual(traced);
  });

  it("les lettres passent avant le vocabulaire, et un seul écran final", () => {
    const deck = buildLessonDeck(parts, seeded());
    const firstLetter = deck.findIndex((s) => s.kind === "letter");
    const firstCard = deck.findIndex((s) => s.kind === "flashcard");
    expect(firstLetter).toBeLessThan(firstCard);
    expect(deck.filter((s) => s.kind === "bravo")).toHaveLength(1);
  });

  it("n'écrit le titre dans la vidéo que s'il est en arabe", () => {
    const french = lessonParts("Les fruits", blocks, "#000");
    expect(recapProps(french).parts.find((p) => p.kind === "vocab")).toMatchObject({ title: null });
    expect(recapProps(parts).parts.find((p) => p.kind === "vocab")).toMatchObject({ title: "الْفَوَاكِه" });
  });
});

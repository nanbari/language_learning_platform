import { describe, it, expect } from "vitest";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { EXERCISE_WORDS, LETTER_POSITIONS, exerciseWords } from "@/data/letterWords";
import { joinedSegments, stripDiacritics } from "./arabicWord";

const ZWJ = "\u200d";
const ALIFS = ["ا", "أ", "إ", "آ"];

describe("mots-exemples et mots d'exercice", () => {
  it("donne à chaque lettre des mots supplémentaires pour chaque position", () => {
    for (const letter of ARABIC_ALPHABET) {
      for (const position of LETTER_POSITIONS) {
        expect(EXERCISE_WORDS[letter.id][position].length).toBeGreaterThan(0);
        const texts = exerciseWords(letter.id, position).map((w) => w.text);
        expect(new Set(texts).size).toBe(texts.length);
      }
    }
  });

  it("met entre crochets la lettre étudiée, avec le tracé de sa position", () => {
    const wrong: string[] = [];
    for (const letter of ARABIC_ALPHABET) {
      for (const position of LETTER_POSITIONS) {
        for (const word of exerciseWords(letter.id, position)) {
          const { target } = joinedSegments(word.text);
          const bare = stripDiacritics(target.replaceAll(ZWJ, ""));
          const sameLetter = letter.id === 1 ? ALIFS.includes(bare) : bare === letter.isolated;
          const left = target.startsWith(ZWJ);
          const right = target.endsWith(ZWJ);
          const shape = left && right ? letter.medial : left ? letter.final : right ? letter.initial : letter.isolated;
          if (!sameLetter || shape !== letter[position]) wrong.push(`${letter.nameTranslit} ${position} : ${word.text}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

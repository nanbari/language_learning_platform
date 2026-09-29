import { describe, it, expect } from "vitest";
import { joinedSegments, splitMarkedWord, stripDiacritics } from "./arabicWord";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import { LETTER_POSITIONS, LETTER_WORDS } from "@/data/letterWords";

const ZWJ = "‍";
const ALIF_FORMS = ["ا", "أ", "إ", "آ"];

describe("splitMarkedWord", () => {
  it("isole la lettre balisée avec ses voyelles", () => {
    expect(splitMarkedWord("كِ[تَ]اب")).toEqual({ before: "كِ", target: "تَ", after: "اب" });
    expect(splitMarkedWord("[بَ]طَّة")).toEqual({ before: "", target: "بَ", after: "طَّة" });
  });

  it("refuse un mot sans balise ou à balises multiples", () => {
    expect(() => splitMarkedWord("كتاب")).toThrow();
    expect(() => splitMarkedWord("[ك]ت[ا]ب")).toThrow();
  });
});

describe("joinedSegments", () => {
  it("pose un liant de chaque côté d'une coupure entre lettres attachées", () => {
    expect(joinedSegments("جَ[بَ]ل")).toEqual({ before: `جَ${ZWJ}`, target: `${ZWJ}بَ${ZWJ}`, after: `${ZWJ}ل` });
  });

  it("n'en pose pas après une lettre qui ne s'attache pas à la suivante", () => {
    // ا ne se lie pas au ب qui suit ; ر ne se lie pas au س.
    expect(joinedSegments("بَ[ا]ب")).toEqual({ before: `بَ${ZWJ}`, target: `${ZWJ}ا`, after: "ب" });
    expect(joinedSegments("جَ[رَ]س").after).toBe("س");
    // Après un ا, la lettre finale reste détachée.
    expect(joinedSegments("حِصَا[ن]")).toEqual({ before: "حِصَا", target: "ن", after: "" });
  });

  it("restitue le mot d'origine une fois les liants retirés", () => {
    const { before, target, after } = joinedSegments("مَ[دْ]رَسَة");
    expect((before + target + after).replaceAll(ZWJ, "")).toBe("مَدْرَسَة");
  });
});

describe("LETTER_WORDS", () => {
  it("fournit trois mots pour chacune des 28 lettres", () => {
    expect(Object.keys(LETTER_WORDS)).toHaveLength(28);
    for (const letter of ARABIC_ALPHABET) {
      for (const position of LETTER_POSITIONS) expect(LETTER_WORDS[letter.id][position]).toBeDefined();
    }
  });

  it("balise la bonne lettre, à la bonne place, une seule fois dans le mot", () => {
    for (const letter of ARABIC_ALPHABET) {
      const accepted = letter.id === 1 ? ALIF_FORMS : [letter.isolated];
      for (const position of LETTER_POSITIONS) {
        const { text } = LETTER_WORDS[letter.id][position];
        const { before, target, after } = splitMarkedWord(text);
        const label = `${letter.nameTranslit} ${position} « ${text} »`;

        expect(accepted, label).toContain(stripDiacritics(target));
        expect(before === "", label).toBe(position === "initial");
        expect(after === "", label).toBe(position === "final");
        // Une seconde occurrence, non colorée, dérouterait l'élève.
        const rest = stripDiacritics(before + after);
        for (const form of accepted) expect(rest.includes(form), label).toBe(false);
      }
    }
  });
});

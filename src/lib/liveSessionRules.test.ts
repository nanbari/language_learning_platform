import { describe, it, expect } from "vitest";
import { ARABIC_ALPHABET } from "@/data/arabicAlphabet";
import type { Slide } from "@/lib/presentation";
import { buildTally, isCorrectChoice, isLiveState, summarize, type LiveAnswer } from "@/lib/liveSession";

const [alif, ba, ta] = ARABIC_ALPHABET;

describe("isCorrectChoice (exactitude établie par le serveur)", () => {
  it("lettres : la cible parmi les choix, et rien d'autre", () => {
    const slide: Slide = { kind: "findLetter", target: ba, choices: [alif, ba, ta] };
    expect(isCorrectChoice(slide, String(ba.id))).toBe(true);
    expect(isCorrectChoice(slide, String(alif.id))).toBe(false);
    expect(isCorrectChoice(slide, "999")).toBeNull();
    expect(isCorrectChoice({ kind: "pickSound", target: ta, choices: [ba, ta] }, String(ta.id))).toBe(true);
  });

  it("compléter le mot : la forme attendue, par sa position", () => {
    const slide: Slide = {
      kind: "completeWord", letter: ba, position: "medial",
      word: { word: "", meaning: "", highlight: 0 } as never,
      choices: [{ position: "initial", glyph: ba.initial }, { position: "medial", glyph: ba.medial }],
    };
    expect(isCorrectChoice(slide, "medial")).toBe(true);
    expect(isCorrectChoice(slide, "initial")).toBe(false);
    expect(isCorrectChoice(slide, "final")).toBeNull();
  });

  it("quiz et QCM : l'identifiant de la bonne réponse", () => {
    const quiz: Slide = { kind: "quiz", target: { id: "w1" }, choices: [{ id: "w1" }, { id: "w2" }], color: "#000" };
    expect(isCorrectChoice(quiz, "w1")).toBe(true);
    expect(isCorrectChoice(quiz, "w2")).toBe(false);
    expect(isCorrectChoice(quiz, "w3")).toBeNull();
    const qcm: Slide = { kind: "qcm", color: "#000", qcm: { id: "q", options: [{ id: "a" }, { id: "b" }], correctId: "b" } };
    expect(isCorrectChoice(qcm, "b")).toBe(true);
    expect(isCorrectChoice(qcm, "a")).toBe(false);
  });

  it("écriture : seul « done » vaut ; un écran sans réponse refuse tout", () => {
    expect(isCorrectChoice({ kind: "write", letter: ba }, "done")).toBe(true);
    expect(isCorrectChoice({ kind: "write", letter: ba }, "x")).toBeNull();
    expect(isCorrectChoice({ kind: "bravo" }, "done")).toBeNull();
    expect(isCorrectChoice({ kind: "letter", letter: ba }, String(ba.id))).toBeNull();
  });
});

describe("buildTally", () => {
  it("reconstruit le décompte dans l'ordre d'arrivée : le premier essai compte, la réussite est retenue", () => {
    const answers: LiveAnswer[] = [
      { slideIndex: 2, studentId: "a", name: "Amina", choiceId: "x", correct: false },
      { slideIndex: 2, studentId: "a", name: "Amina", choiceId: "y", correct: true },
      { slideIndex: 2, studentId: "b", name: "Bilal", choiceId: "y", correct: true },
    ];
    const summary = summarize(buildTally(answers), 2);
    expect(summary.answered).toBe(2);
    expect(summary.counts).toEqual({ x: 1, y: 1 });
    expect(summary.found).toEqual(["Amina", "Bilal"]);
  });
});

describe("isLiveState", () => {
  it("accepte la forme d'un état et refuse le reste", () => {
    expect(isLiveState({ index: 0, total: 3, step: 0, revealed: false, slide: { kind: "bravo" } })).toBe(true);
    expect(isLiveState({ index: 3, total: 3, step: 0, revealed: false, slide: { kind: "bravo" } })).toBe(false);
    expect(isLiveState({ index: 0, total: 3, step: 0, revealed: "non", slide: { kind: "bravo" } })).toBe(false);
    expect(isLiveState({ index: 0, total: 3, step: 0, revealed: true, slide: null })).toBe(false);
    expect(isLiveState("état")).toBe(false);
  });
});

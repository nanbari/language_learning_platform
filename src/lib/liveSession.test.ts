import { describe, it, expect } from "vitest";
import { generateCode, normalizeCode, recordAnswer, summarize, isGame, type Tally, type LiveAnswer } from "./liveSession";

const answer = (over: Partial<LiveAnswer>): LiveAnswer => ({
  slideIndex: 3, studentId: "s1", name: "Lina", choiceId: "a1", correct: false, ...over,
});

describe("codes de séance", () => {
  it("génère quatre chiffres", () => {
    expect(generateCode()).toMatch(/^\d{4}$/);
    expect(generateCode(() => 0)).toBe("0000");
  });

  it("nettoie la saisie de l'élève", () => {
    expect(normalizeCode(" 48-21 ")).toBe("4821");
    expect(normalizeCode("123456")).toBe("1234");
  });
});

describe("recordAnswer / summarize", () => {
  it("ne compte que le premier essai par choix, mais retient la réussite", () => {
    let tally: Tally = {};
    tally = recordAnswer(tally, answer({ choiceId: "a2", correct: false }));
    tally = recordAnswer(tally, answer({ choiceId: "a1", correct: true }));
    const summary = summarize(tally, 3);
    expect(summary.answered).toBe(1);
    expect(summary.counts).toEqual({ a2: 1 });
    expect(summary.found).toEqual(["Lina"]);
  });

  it("sépare les élèves et les écrans", () => {
    let tally: Tally = {};
    tally = recordAnswer(tally, answer({ correct: true }));
    tally = recordAnswer(tally, answer({ studentId: "s2", name: "Adam", choiceId: "a4" }));
    tally = recordAnswer(tally, answer({ slideIndex: 4, correct: true }));
    expect(summarize(tally, 3)).toEqual({ answered: 2, found: ["Lina"], counts: { a1: 1, a4: 1 } });
    expect(summarize(tally, 9)).toEqual({ answered: 0, found: [], counts: {} });
  });

  it("ne modifie pas le décompte précédent", () => {
    const before: Tally = {};
    recordAnswer(before, answer({}));
    expect(before).toEqual({});
  });
});

describe("isGame", () => {
  it("ne retient que les écrans à réponse", () => {
    expect(isGame({ kind: "bravo" })).toBe(false);
    expect(isGame({ kind: "quiz", target: { id: "a1", arabic: "" }, choices: [], color: "" })).toBe(true);
    const clip = { id: "a1", clip: { src: "/a.mp4", caption: "", question: "" } };
    expect(isGame({ kind: "clipQuiz", target: clip, choices: [clip], color: "" })).toBe(true);
    expect(isGame({ kind: "qcm", qcm: { id: "q", question: "?", options: [], correctId: "" }, color: "" })).toBe(true);
  });
});

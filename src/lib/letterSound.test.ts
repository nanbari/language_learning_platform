import { describe, it, expect } from "vitest";
import { readsQuestionOnArrival } from "./letterSound";
import { buildLetterDeck } from "./presentation";
import { isGame } from "./liveSession";

describe("readsQuestionOnArrival", () => {
  it("lit la question au premier exercice d'une suite de même type seulement", () => {
    expect(readsQuestionOnArrival("completeWord", undefined)).toBe(true);
    expect(readsQuestionOnArrival("completeWord", "forms")).toBe(true);
    expect(readsQuestionOnArrival("completeWord", "completeWord")).toBe(false);
    expect(readsQuestionOnArrival("findInWord", "completeWord")).toBe(true);
  });

  it("ne concerne que les exercices à question enregistrée", () => {
    expect(readsQuestionOnArrival("findLetter", undefined)).toBe(false);
    expect(readsQuestionOnArrival("write", "write")).toBe(false);
  });

  it("pose une seule fois la question des trois mots à compléter du niveau avancé", () => {
    const games = buildLetterDeck([2], "advanced", [], () => 0.5).filter(isGame);
    const completeWord = games.filter((s) => s.kind === "completeWord");
    expect(completeWord).toHaveLength(3);
    const read = games.filter((s, i) => s.kind === "completeWord" && readsQuestionOnArrival(s.kind, games[i - 1]?.kind));
    expect(read).toHaveLength(1);
  });
});

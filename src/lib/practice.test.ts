import { describe, it, expect } from "vitest";
import {
  toPracticeBlocks, toReplayBlocks, toPracticeSources, MAX_REPLAY_PER_SET,
  GENERATED_PREFIX, GeneratedSetSchema, type GeneratedSet,
} from "./practice";
import type { ReviewableExercise, WeakSpot } from "./weakSpots";

const sources = new Map<string, ReviewableExercise>([
  ["q1", {
    type: "quiz", question: "Quelle lettre fait le son « b » ?", answerMode: "text",
    options: [{ id: "o1", text: "ب" }, { id: "o2", text: "ت" }, { id: "o3", text: "ث" }],
    correctId: "o1",
  }],
  ["w1", { type: "wordorder", sentence: "أنا أحب المدرسة" }],
]);

describe("toPracticeBlocks", () => {
  it("convertit un quiz et une remise en ordre valides en blocs jouables", () => {
    const generated: GeneratedSet = {
      exercises: [
        { type: "quiz", sourceBlockId: "q1", question: "Quelle lettre fait le son « t » ?", options: ["ب", "ت", "ث"], correctIndex: 1 },
        { type: "wordorder", sourceBlockId: "w1", sentence: "أنا أحب  القراءة" },
      ],
    };
    const blocks = toPracticeBlocks(generated, sources);
    expect(blocks).toHaveLength(2);

    const [quiz, wo] = blocks;
    expect(quiz.id.startsWith(GENERATED_PREFIX)).toBe(true);
    expect(quiz.type).toBe("exercise");
    if (quiz.exercise.type !== "quiz") throw new Error("quiz attendu");
    expect(quiz.exercise.answerMode).toBe("text");
    expect(quiz.exercise.options.map((o) => o.text)).toEqual(["ب", "ت", "ث"]);
    const correctId = quiz.exercise.correctId;
    const correct = quiz.exercise.options.find((o) => o.id === correctId);
    expect(correct?.text).toBe("ت");
    expect(new Set(quiz.exercise.options.map((o) => o.id)).size).toBe(3);

    if (wo.exercise.type !== "wordorder") throw new Error("wordorder attendu");
    expect(wo.exercise.sentence).toBe("أنا أحب القراءة"); // espaces normalisés
  });

  it("écarte les exercices invalides ou hors sujet", () => {
    const generated: GeneratedSet = {
      exercises: [
        // source inconnue
        { type: "quiz", sourceBlockId: "nope", question: "?", options: ["a", "b", "c"], correctIndex: 0 },
        // type différent de la source
        { type: "wordorder", sourceBlockId: "q1", sentence: "un deux trois" },
        // mauvais nombre d'options
        { type: "quiz", sourceBlockId: "q1", question: "Q ?", options: ["a", "b"], correctIndex: 0 },
        // index hors limites
        { type: "quiz", sourceBlockId: "q1", question: "Q ?", options: ["a", "b", "c"], correctIndex: 3 },
        // options en doublon
        { type: "quiz", sourceBlockId: "q1", question: "Q ?", options: ["a", "A ", "c"], correctIndex: 0 },
        // copie de la question d'origine
        { type: "quiz", sourceBlockId: "q1", question: " quelle lettre fait le son « b » ? ", options: ["a", "b", "c"], correctIndex: 0 },
        // phrase trop courte / copie de l'originale
        { type: "wordorder", sourceBlockId: "w1", sentence: "مرحبا" },
        { type: "wordorder", sourceBlockId: "w1", sentence: "أنا أحب المدرسة" },
      ],
    };
    expect(toPracticeBlocks(generated, sources)).toEqual([]);
  });

  it("dédoublonne les exercices générés identiques", () => {
    const generated: GeneratedSet = {
      exercises: [
        { type: "wordorder", sourceBlockId: "w1", sentence: "هي تقرأ كتابا" },
        { type: "wordorder", sourceBlockId: "w1", sentence: "هي تقرأ كتابا" },
      ],
    };
    expect(toPracticeBlocks(generated, sources)).toHaveLength(1);
  });
});

describe("GeneratedSetSchema", () => {
  it("rejette un type d'exercice inconnu", () => {
    const r = GeneratedSetSchema.safeParse({ exercises: [{ type: "matching", sourceBlockId: "q1" }] });
    expect(r.success).toBe(false);
  });
});

function spot(blockId: string, exercise: ReviewableExercise, extra: Partial<WeakSpot> = {}): WeakSpot {
  return {
    blockId, exercise, attempts: 2, wrongAttempts: 1, completed: true, hints: 0,
    totalWrongAttempts: 1, wrongAnswers: [], lastSeenAt: "2026-01-01T00:00:00.000Z", score: 0.5,
    ...extra,
  };
}

describe("toReplayBlocks", () => {
  const quiz = sources.get("q1")!;
  const wo   = sources.get("w1")!;

  it("rejoue les exercices d'origine en gardant leur id et leur contenu", () => {
    const blocks = toReplayBlocks([spot("q1", quiz), spot("w1", wo)]);
    expect(blocks.map((b) => b.id)).toEqual(["q1", "w1"]);
    expect(blocks[1].exercise).toEqual(wo);
    const q = blocks[0].exercise;
    if (q.type !== "quiz") throw new Error("quiz attendu");
    expect(q.correctId).toBe(quiz.type === "quiz" ? quiz.correctId : "");
    expect([...q.options].sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual([...(quiz as Extract<ReviewableExercise, { type: "quiz" }>).options].sort((a, b) => a.id.localeCompare(b.id)));
  });

  it("ne modifie pas l'exercice d'origine et plafonne la série", () => {
    const original = JSON.stringify(quiz);
    const many = Array.from({ length: MAX_REPLAY_PER_SET + 3 }, (_, i) => spot(`q${i}`, quiz));
    expect(toReplayBlocks(many)).toHaveLength(MAX_REPLAY_PER_SET);
    expect(JSON.stringify(quiz)).toBe(original);
  });
});

describe("toPracticeSources", () => {
  it("résume chaque point faible avec un libellé lisible", () => {
    const s = toPracticeSources([spot("w1", sources.get("w1")!, { wrongAttempts: 3, wrongAnswers: ["a b"] })]);
    expect(s).toEqual([{ blockId: "w1", type: "wordorder", label: "أنا أحب المدرسة", wrongAttempts: 3, wrongAnswers: ["a b"] }]);
  });
});

import { describe, it, expect } from "vitest";
import { analyseWeakSpots, describeAnswer, summariseWeakSpots } from "./weakSpots";
import type { ContentBlock, QuizExercise, WordOrderExercise } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "./exerciseEvents";

const LESSON = "123e4567-e89b-12d3-a456-426614174000";
const USER   = "223e4567-e89b-12d3-a456-426614174000";

const quiz: QuizExercise = {
  type: "quiz", question: "Quelle lettre fait le son « b » ?", answerMode: "text",
  options: [{ id: "o1", text: "ب" }, { id: "o2", text: "ت" }, { id: "o3", text: "ث" }],
  correctId: "o1",
};
const wordorder: WordOrderExercise = { type: "wordorder", sentence: "أنا أحب المدرسة" };

const blocks: ContentBlock[] = [
  { id: "vid", type: "video", url: "", title: "" },
  { id: "q1", type: "exercise", exercise: quiz },
  { id: "w1", type: "exercise", exercise: wordorder },
  { id: "m1", type: "exercise", exercise: { type: "matching", pairs: [] } },
];

let seq = 0;
function ev(partial: Partial<ExerciseEventRow> & { block_id: string; event_type: ExerciseEventRow["event_type"] }): ExerciseEventRow {
  seq += 1;
  return {
    id: `e${seq}`, user_id: USER, lesson_id: LESSON,
    exercise_type: partial.block_id.startsWith("w") ? "wordorder" : "quiz",
    correct: null, answer: null, attempt_number: null, hint_count: 0, time_ms: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    ...partial,
  };
}

describe("analyseWeakSpots", () => {
  it("ignore les exercices réussis du premier coup et ceux jamais tentés", () => {
    const events = [
      ev({ block_id: "q1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 1 }),
      ev({ block_id: "m1", event_type: "view" }),
    ];
    expect(analyseWeakSpots(blocks, events)).toEqual([]);
  });

  it("signale un exercice réussi après une erreur, avec la réponse fausse lisible", () => {
    const events = [
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "attempt", correct: true,  answer: { optionId: "o1" }, attempt_number: 2 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
    ];
    const spots = analyseWeakSpots(blocks, events);
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ blockId: "q1", attempts: 2, wrongAttempts: 1, completed: true, wrongAnswers: ["ت"] });
  });

  it("signale un exercice abandonné sans réussite comme plus fragile qu'un exercice finalement réussi", () => {
    const events = [
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o3" }, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "attempt", correct: true, attempt_number: 2 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ block_id: "w1", event_type: "attempt", correct: false, answer: { words: ["المدرسة", "أنا", "أحب"] }, attempt_number: 1 }),
    ];
    const spots = analyseWeakSpots(blocks, events);
    expect(spots.map((s) => s.blockId)).toEqual(["w1", "q1"]);
    expect(spots[0]).toMatchObject({ completed: false, wrongAnswers: ["المدرسة أنا أحب"] });
  });

  it("ne tient compte que de la dernière passe", () => {
    const events = [
      // Première passe : ratée puis réussie
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "attempt", correct: true, attempt_number: 2 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      // Deuxième passe : réussie du premier coup
      ev({ block_id: "q1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 1 }),
    ];
    expect(analyseWeakSpots(blocks, events)).toEqual([]);
  });

  it("accepte des événements dans le désordre et d'autres blocs", () => {
    const events = [
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ block_id: "zzz", event_type: "attempt", correct: false }),
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
    ];
    // Le complete a un created_at antérieur à l'essai faux : l'essai faux forme la dernière passe.
    const spots = analyseWeakSpots(blocks, events);
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ blockId: "q1", completed: false, wrongAttempts: 1 });
  });

  it("dédoublonne les réponses fausses, la plus récente d'abord", () => {
    const events = [
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o3" }, attempt_number: 2 }),
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 3 }),
    ];
    expect(analyseWeakSpots(blocks, events)[0].wrongAnswers).toEqual(["ت", "ث"]);
  });
});

describe("describeAnswer", () => {
  it("rend null pour une réponse inconnue ou malformée", () => {
    expect(describeAnswer(quiz, null)).toBeNull();
    expect(describeAnswer(quiz, { optionId: "nope" })).toBeNull();
    expect(describeAnswer(wordorder, { words: [] })).toBeNull();
    expect(describeAnswer(wordorder, { words: [1, 2] })).toBeNull();
  });
});

describe("summariseWeakSpots", () => {
  const LESSON2 = "323e4567-e89b-12d3-a456-426614174000";
  const lessons = [
    { id: LESSON,  blocks },
    { id: LESSON2, blocks: [{ id: "q1", type: "exercise" as const, exercise: quiz }] },
  ];

  it("ne rend que les leçons ayant un exercice à revoir, les plus récentes d'abord", () => {
    const events = [
      // Leçon 1 : quiz raté puis réussi ; remise en ordre réussie du premier coup
      ev({ block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "attempt", correct: true, attempt_number: 2 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ block_id: "w1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ block_id: "w1", event_type: "complete", correct: true, attempt_number: 1 }),
      // Leçon 2 : même block_id q1, raté plus tard et abandonné
      ev({ lesson_id: LESSON2, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o3" }, attempt_number: 1 }),
    ];
    const summary = summariseWeakSpots(lessons, events);
    expect(summary.map((s) => s.lessonId)).toEqual([LESSON2, LESSON]);
    expect(summary[0]).toMatchObject({ toReview: 1, reviewable: 1 });
    expect(summary[1]).toMatchObject({ toReview: 1, reviewable: 2 });
    expect(summary[1].lastFailedAt).toBe(events[2].created_at);
  });

  it("rend une liste vide sans événement ou sans échec", () => {
    expect(summariseWeakSpots(lessons, [])).toEqual([]);
    const events = [
      ev({ block_id: "q1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ block_id: "q1", event_type: "complete", correct: true, attempt_number: 1 }),
    ];
    expect(summariseWeakSpots(lessons, events)).toEqual([]);
  });
});

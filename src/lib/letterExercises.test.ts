import { describe, it, expect } from "vitest";
import { letterGames, type LettersBlock } from "./letterExercises";
import { analyseWeakSpots, describeAnswer, summariseWeakSpots } from "./weakSpots";
import { toReplayBlocks, exerciseLabel } from "./practice";
import type { ExerciseEventRow } from "./exerciseEvents";

const LESSON = "123e4567-e89b-12d3-a456-426614174000";
const block: LettersBlock = { id: "let1", type: "letters", level: "beginner", letterIds: [2, 3] };

let seq = 0;
function ev(partial: Partial<ExerciseEventRow> & { block_id: string; event_type: ExerciseEventRow["event_type"] }): ExerciseEventRow {
  seq += 1;
  return {
    id: `e${seq}`, user_id: "u", lesson_id: LESSON, exercise_type: "quiz",
    correct: null, answer: null, attempt_number: null, hint_count: 0, time_ms: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    ...partial,
  };
}

describe("letterGames", () => {
  it("donne aux jeux des ids stables d'un tirage à l'autre, sans l'écriture", () => {
    const a = letterGames(block).map((g) => g.id).sort();
    const b = letterGames(block).map((g) => g.id).sort();
    expect(a).toEqual(b);
    expect(a).toEqual(["let1:findLetter:2", "let1:findLetter:3", "let1:pickSound:2", "let1:pickSound:3"]);
  });
});

describe("jeux de lettres et révision", () => {
  it("signale un jeu de lettres raté et le rejoue, réponse fausse lisible", () => {
    const events = [
      ev({ block_id: "let1:pickSound:2", event_type: "attempt", correct: false, answer: { choiceId: "3" }, attempt_number: 1 }),
      ev({ block_id: "let1:pickSound:2", event_type: "attempt", correct: true, answer: { choiceId: "2" }, attempt_number: 2 }),
      ev({ block_id: "let1:pickSound:2", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ block_id: "let1:findLetter:3", event_type: "attempt", correct: true, answer: { choiceId: "3" }, attempt_number: 1 }),
      ev({ block_id: "let1:findLetter:3", event_type: "complete", correct: true, attempt_number: 1 }),
    ];
    const spots = analyseWeakSpots([block], events);
    expect(spots.map((s) => s.blockId)).toEqual(["let1:pickSound:2"]);
    expect(spots[0].wrongAnswers).toEqual(["ت"]);
    expect(describeAnswer(spots[0].exercise, { choiceId: "2" })).toBe("ب");
    expect(exerciseLabel(spots[0].exercise)).toBe("Choisir le son · ب");

    const [replay] = toReplayBlocks(spots);
    expect(replay).toMatchObject({ id: "let1:pickSound:2", type: "exercise", exercise: { type: "letterGame", slide: { kind: "pickSound" } } });

    expect(summariseWeakSpots([{ id: LESSON, blocks: [block] }], events)).toMatchObject([{ toReview: 1, reviewable: 4 }]);
  });
});

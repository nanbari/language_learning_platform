import { describe, it, expect } from "vitest";
import { parseExerciseEvent, MAX_TIME_MS } from "./exerciseEvents";

const LESSON = "123e4567-e89b-12d3-a456-426614174000";
const base = { lesson_id: LESSON, block_id: "ab12cd", exercise_type: "quiz", event_type: "attempt" };

describe("parseExerciseEvent", () => {
  it("accepte un événement minimal et remplit les valeurs par défaut", () => {
    const r = parseExerciseEvent(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      ...base,
      correct: null,
      answer: null,
      attempt_number: null,
      hint_count: 0,
      time_ms: null,
    });
  });

  it("conserve la réponse, l'essai et le temps", () => {
    const r = parseExerciseEvent({ ...base, correct: false, answer: { optionId: "x" }, attempt_number: 2, time_ms: 1234.6 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.correct).toBe(false);
    expect(r.value.answer).toEqual({ optionId: "x" });
    expect(r.value.attempt_number).toBe(2);
    expect(r.value.time_ms).toBe(1235);
  });

  it("écrête un temps aberrant", () => {
    const r = parseExerciseEvent({ ...base, time_ms: MAX_TIME_MS * 10 });
    expect(r.ok && r.value.time_ms).toBe(MAX_TIME_MS);
  });

  it("rejette les identifiants et types invalides", () => {
    expect(parseExerciseEvent({ ...base, lesson_id: "pas-un-uuid" }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, block_id: "" }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, exercise_type: "puzzle" }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, event_type: "click" }).ok).toBe(false);
    expect(parseExerciseEvent(null).ok).toBe(false);
    expect(parseExerciseEvent([]).ok).toBe(false);
  });

  it("rejette les champs mal typés", () => {
    expect(parseExerciseEvent({ ...base, correct: "oui" }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, answer: ["a"] }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, attempt_number: 0 }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, attempt_number: -1 }).ok).toBe(false);
    expect(parseExerciseEvent({ ...base, time_ms: "vite" }).ok).toBe(false);
  });

  it("rejette une réponse trop volumineuse", () => {
    const r = parseExerciseEvent({ ...base, answer: { blob: "x".repeat(5000) } });
    expect(r.ok).toBe(false);
  });
});

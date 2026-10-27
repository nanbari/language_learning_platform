// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const events = vi.hoisted(() => ({ logged: [] as Record<string, unknown>[] }));
vi.mock("@/lib/api/events", () => ({
  logExerciseEvent: (e: Record<string, unknown>) => { events.logged.push(e); },
  flushExerciseEvents: async () => {},
}));
vi.mock("@/lib/soundPlayer", () => ({ playSound: async () => true, stopSound: () => {} }));

import { QuizRenderer, type QuizExercise } from "@/components/lesson/ExerciseRenderers";

const LESSON = "00000000-0000-4000-8000-000000000200";
const quiz: QuizExercise = {
  type: "quiz",
  question: "Où est le lion ?",
  options: [{ id: "lion", text: "Lion" }, { id: "chat", text: "Chat" }, { id: "ours", text: "Ours" }],
  correctId: "lion",
  answerMode: "text",
};

beforeEach(() => { events.logged.length = 0; vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("QuizRenderer — pédagogie du QCM", () => {
  it("une mauvaise réponse est marquée « déjà essayée », reste rejouable, et ne passe pas à la suite", () => {
    const onNext = vi.fn();
    render(<QuizRenderer ex={quiz} color="#6B705C" onNext={onNext} idx={0} total={1} lessonId={LESSON} blockId="b1" />);
    expect(screen.getByText("Où est le lion ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByRole("button", { name: "Chat — déjà essayée" })).toHaveAttribute("data-state", "tried");
    expect(screen.getByRole("button", { name: "Lion" })).not.toBeDisabled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onNext).not.toHaveBeenCalled();
    expect(events.logged.filter((e) => e.event_type === "attempt").map((e) => e.correct)).toEqual([false]);
  });

  it("la bonne réponse est confirmée, les boutons se figent, l'événement « complete » part et la suite vient après la pause", async () => {
    const onNext = vi.fn();
    render(<QuizRenderer ex={quiz} color="#6B705C" onNext={onNext} idx={0} total={1} lessonId={LESSON} blockId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Ours" }));
    fireEvent.click(screen.getByRole("button", { name: "Lion" }));
    expect(screen.getByRole("button", { name: "Lion — bonne réponse" })).toHaveAttribute("data-state", "found");
    expect(screen.getByRole("button", { name: "Lion — bonne réponse" })).toBeDisabled();
    // Un clic de plus ne change rien : l'exercice est terminé.
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    const attempts = events.logged.filter((e) => e.event_type === "attempt");
    expect(attempts.map((e) => e.correct)).toEqual([false, true]);
    expect(attempts[1]).toMatchObject({ attempt_number: 2, lesson_id: LESSON, block_id: "b1", exercise_type: "quiz" });
    expect(events.logged.some((e) => e.event_type === "complete")).toBe(true);
    expect(onNext).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { logExerciseEvent } from "./eventsApi";
import type { ExerciseType } from "./exerciseEvents";

export interface ExerciseTracker {
  /** Enregistre une réponse. Si elle est correcte, enregistre aussi la réussite. */
  attempt: (correct: boolean, answer?: Record<string, unknown>) => void;
  /** Enregistre l'affichage d'un indice. */
  hint: () => void;
  /** Enregistre un exercice affiché puis passé sans réponse. */
  view: () => void;
}

interface Params {
  lessonId: string;
  blockId: string;
  exerciseType: ExerciseType;
}

/**
 * Suit un exercice pendant son affichage : chronomètre, compteur d'essais et
 * d'indices. À monter dans le composant de rendu de l'exercice (remonté à
 * chaque bloc grâce à `key`), pour que chaque exercice ait son propre suivi.
 */
export function useExerciseTracker({ lessonId, blockId, exerciseType }: Params): ExerciseTracker {
  const startedAt = useRef<number | null>(null);
  const attempts  = useRef(0);
  const hints     = useRef(0);
  const finished  = useRef(false);

  // Le chronomètre démarre à l'affichage ; tout repart de zéro si l'exercice change.
  useEffect(() => {
    startedAt.current = performance.now();
    attempts.current = 0;
    hints.current = 0;
    finished.current = false;
  }, [lessonId, blockId, exerciseType]);

  const elapsed = useCallback(() => {
    if (startedAt.current === null) startedAt.current = performance.now();
    return Math.round(performance.now() - startedAt.current);
  }, []);

  const attempt = useCallback<ExerciseTracker["attempt"]>((correct, answer) => {
    if (finished.current) return;
    attempts.current += 1;
    const time_ms = elapsed();
    const base = { lesson_id: lessonId, block_id: blockId, exercise_type: exerciseType };
    logExerciseEvent({
      ...base, event_type: "attempt", correct, answer: answer ?? null,
      attempt_number: attempts.current, hint_count: hints.current, time_ms,
    });
    if (correct) {
      finished.current = true;
      logExerciseEvent({
        ...base, event_type: "complete", correct: true,
        attempt_number: attempts.current, hint_count: hints.current, time_ms,
      });
    }
  }, [lessonId, blockId, exerciseType, elapsed]);

  const hint = useCallback(() => {
    if (finished.current) return;
    hints.current += 1;
    logExerciseEvent({
      lesson_id: lessonId, block_id: blockId, exercise_type: exerciseType,
      event_type: "hint", hint_count: hints.current, time_ms: elapsed(),
    });
  }, [lessonId, blockId, exerciseType, elapsed]);

  const view = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    logExerciseEvent({
      lesson_id: lessonId, block_id: blockId, exercise_type: exerciseType,
      event_type: "view", time_ms: elapsed(),
    });
  }, [lessonId, blockId, exerciseType, elapsed]);

  return useMemo(() => ({ attempt, hint, view }), [attempt, hint, view]);
}

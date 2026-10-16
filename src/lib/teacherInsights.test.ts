import { describe, it, expect } from "vitest";
import { buildTeacherInsights, exerciseSummaryLabel, describeAnswerRich, correctAnswerOf } from "./teacherInsights";
import type { ContentBlock, QuizExercise, WordOrderExercise } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "./exerciseEvents";

const L1 = "123e4567-e89b-12d3-a456-426614174000";
const L2 = "223e4567-e89b-12d3-a456-426614174000";
const ANNA = "a23e4567-e89b-12d3-a456-426614174000";
const BOB  = "b23e4567-e89b-12d3-a456-426614174000";

const quiz: QuizExercise = {
  type: "quiz", question: "Quelle lettre fait le son « b » ?", answerMode: "text",
  options: [{ id: "o1", text: "ب" }, { id: "o2", text: "ت" }, { id: "o3", text: "ث" }],
  correctId: "o1",
};
const wordorder: WordOrderExercise = { type: "wordorder", sentence: "أنا أحب المدرسة" };
/** Quiz en images sans texte, consigne audio (cas courant en maternelle). */
const imageQuiz: QuizExercise = {
  type: "quiz", question: "", answerMode: "image", audioDataUrl: "https://cdn/consigne.mp3",
  options: [
    { id: "i1", text: "", imageDataUrl: "https://cdn/pomme.png" },
    { id: "i2", text: "", imageDataUrl: "https://cdn/banane.png" },
    { id: "i3", text: "" },
  ],
  correctId: "i1",
};

const blocks: ContentBlock[] = [
  { id: "vid", type: "video", url: "", title: "" },
  { id: "q1", type: "exercise", exercise: quiz },
  { id: "w1", type: "exercise", exercise: wordorder },
  { id: "m1", type: "exercise", exercise: { type: "matching", pairs: [{ id: "p", left: "a", right: "b" }] } },
];
const lessons = [
  { id: L1, title: "L'alphabet", blocks },
  { id: L2, title: "Les animaux", blocks: [{ id: "q1", type: "exercise" as const, exercise: quiz }] },
];
const users = [{ id: ANNA, name: "Anna" }, { id: BOB, name: "Bob" }];

let seq = 0;
function ev(p: Partial<ExerciseEventRow> & { user_id: string; block_id: string; event_type: ExerciseEventRow["event_type"] }): ExerciseEventRow {
  seq += 1;
  return {
    id: `e${seq}`, lesson_id: L1,
    exercise_type: p.block_id.startsWith("w") ? "wordorder" : "quiz",
    correct: null, answer: null, attempt_number: null, hint_count: 0, time_ms: null,
    created_at: new Date(Date.UTC(2026, 8, 1, 10, 0, seq)).toISOString(),
    ...p,
  };
}

describe("buildTeacherInsights", () => {
  it("rend des listes vides sans activité", () => {
    expect(buildTeacherInsights(lessons, users, [])).toEqual({ students: [] });
  });

  it("calcule la progression, la réussite du premier coup et la dernière activité par élève et leçon", () => {
    const events = [
      // Anna : quiz raté puis réussi, remise en ordre réussie du premier coup, appariement vu
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: true, answer: { optionId: "o1" }, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "w1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "w1", event_type: "complete", correct: true, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "m1", event_type: "view" }),
      // Bob : quiz raté deux fois et abandonné, sur la leçon 1
      ev({ user_id: BOB, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ user_id: BOB, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o3" }, attempt_number: 2 }),
    ];
    const { students } = buildTeacherInsights(lessons, users, events);

    expect(students.map((s) => s.userName)).toEqual(["Bob", "Anna"]); // activité la plus récente d'abord
    const anna = students[1].lessons[0];
    expect(anna).toMatchObject({
      lessonTitle: "L'alphabet", exercisesTotal: 3, exercisesSeen: 3, exercisesAttempted: 2,
      firstTrySuccesses: 1, firstTryRate: 0.5, toReview: 1,
    });
    expect(anna.lastActivityAt).toBe(events[5].created_at);
    expect(students[0].lessons[0]).toMatchObject({ exercisesSeen: 1, exercisesAttempted: 1, firstTryRate: 0, toReview: 1 });
  });

  it("détaille la progression de chaque élève, leçon par leçon et exercice par exercice", () => {
    const events = [
      // Anna : quiz réussi après une erreur, remise en ordre du premier coup, appariement seulement vu
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: true, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "w1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "w1", event_type: "complete", correct: true, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "m1", event_type: "view" }),
      // Bob : quiz raté deux fois et abandonné ; remise en ordre et appariement jamais vus
      ev({ user_id: BOB, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ user_id: BOB, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o3" }, attempt_number: 2 }),
      ev({ user_id: BOB, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 3 }),
    ];
    const { students } = buildTeacherInsights(lessons, users, events);
    expect(students.map((s) => s.userName)).toEqual(["Bob", "Anna"]); // activité la plus récente d'abord

    const [bob, anna] = students;
    expect(anna).toMatchObject({ exercisesSeen: 3, exercisesAttempted: 2, firstTrySuccesses: 1, firstTryRate: 0.5, wrongAttempts: 1, toReview: 1 });
    expect(anna.lessons).toHaveLength(1);
    expect(anna.lessons[0].exercises.map((e) => [e.position, e.status])).toEqual([[1, "after_errors"], [2, "first_try"], [3, "seen"]]);
    expect(anna.lessons[0].exercises[0]).toMatchObject({
      label: quiz.question, type: "quiz", correctAnswer: { key: "o1", text: "ب", imageUrl: null },
      wrongAttempts: 1, wrongAnswers: [{ key: "o2", text: "ت", count: 1 }],
    });

    expect(bob).toMatchObject({ exercisesSeen: 1, firstTryRate: 0, wrongAttempts: 3, earlierWrongAttempts: 0, toReview: 1 });
    expect(bob.lessons[0].exercises.map((e) => e.status)).toEqual(["failed", "not_started", "not_started"]);
    expect(bob.lessons[0].exercises[0].wrongAnswers).toEqual([
      { key: "o2", text: "ت", imageUrl: null, count: 2 },
      { key: "o3", text: "ث", imageUrl: null, count: 1 },
    ]);
    expect(bob.lessons[0].exercises[1].lastActivityAt).toBeNull();
  });

  it("additionne les leçons d'un même élève, la plus récente d'abord", () => {
    const events = [
      ev({ user_id: ANNA, lesson_id: L2, block_id: "q1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ user_id: ANNA, lesson_id: L1, block_id: "q1", event_type: "attempt", correct: false, attempt_number: 1 }),
    ];
    const [anna] = buildTeacherInsights(lessons, users, events).students;
    expect(anna.lessons.map((l) => l.lessonTitle)).toEqual(["L'alphabet", "Les animaux"]);
    expect(anna).toMatchObject({ exercisesAttempted: 2, firstTrySuccesses: 1, firstTryRate: 0.5, toReview: 1, wrongAttempts: 1 });
  });

  it("décrit un quiz en images sans texte par son rang, sa réponse attendue en image et les images choisies", () => {
    const imgLessons = [{ id: L1, title: "Les fruits", blocks: [
      { id: "vid", type: "video" as const, url: "", title: "" },
      { id: "iq", type: "exercise" as const, exercise: imageQuiz },
    ] }];
    const events = [
      ev({ user_id: ANNA, block_id: "iq", event_type: "attempt", correct: false, answer: { optionId: "i2" }, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "iq", event_type: "attempt", correct: false, answer: { optionId: "i3" }, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "iq", event_type: "attempt", correct: true, answer: { optionId: "i1" }, attempt_number: 3 }),
      ev({ user_id: ANNA, block_id: "iq", event_type: "complete", correct: true, attempt_number: 3 }),
    ];
    const ex = buildTeacherInsights(imgLessons, users, events).students[0].lessons[0].exercises[0];
    expect(ex).toMatchObject({
      label: "Quiz n°1", position: 1, hasAudio: true, status: "after_errors", wrongAttempts: 2,
      correctAnswer: { key: "i1", text: null, imageUrl: "https://cdn/pomme.png" },
      wrongAnswers: [
        { key: "i2", text: null, imageUrl: "https://cdn/banane.png", count: 1 },
        { key: "i3", text: "Option n°3", imageUrl: null, count: 1 },
      ],
    });
  });

  it("ne compte que la dernière passe pour le statut, mais toutes les erreurs pour le total", () => {
    const events = [
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: false, answer: { optionId: "o2" }, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: true, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "complete", correct: true, attempt_number: 2 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "attempt", correct: true, attempt_number: 1 }),
      ev({ user_id: ANNA, block_id: "q1", event_type: "complete", correct: true, attempt_number: 1 }),
    ];
    const { students } = buildTeacherInsights(lessons, users, events);
    expect(students[0].lessons[0]).toMatchObject({ firstTryRate: 1, toReview: 0 });
    // Réussi du premier coup à la dernière passe : 0 erreur, l'ancienne erreur est à part.
    expect(students[0].lessons[0].exercises[0]).toMatchObject({
      status: "first_try", wrongAttempts: 0, wrongAnswers: [],
      earlierWrongAttempts: 1, earlierWrongAnswers: [{ key: "o2", text: "ت", count: 1 }],
    });
    expect(students[0]).toMatchObject({ wrongAttempts: 0, earlierWrongAttempts: 1 });
  });

  it("sépare les leçons partageant des identifiants de bloc", () => {
    const old = new Date(Date.UTC(2026, 5, 1)).toISOString();
    const events = [
      ev({ user_id: ANNA, lesson_id: L2, block_id: "q1", event_type: "attempt", correct: true, attempt_number: 1, created_at: old }),
      ev({ user_id: ANNA, lesson_id: L2, block_id: "q1", event_type: "complete", correct: true, attempt_number: 1, created_at: old }),
      ev({ user_id: BOB,  lesson_id: L1, block_id: "q1", event_type: "attempt", correct: false, attempt_number: 1 }),
    ];
    const { students } = buildTeacherInsights(lessons, users, events);
    expect(students.map((s) => [s.userName, s.lessons.map((l) => l.lessonTitle)]))
      .toEqual([["Bob", ["L'alphabet"]], ["Anna", ["Les animaux"]]]);
  });
});

describe("exerciseSummaryLabel", () => {
  it("décrit chaque type d'exercice, avec un rang quand il n'a pas de texte", () => {
    expect(exerciseSummaryLabel(quiz)).toBe(quiz.question);
    expect(exerciseSummaryLabel(imageQuiz, 4)).toBe("Quiz n°4");
    expect(exerciseSummaryLabel(wordorder)).toBe(wordorder.sentence);
    expect(exerciseSummaryLabel({ type: "matching", pairs: [] }, 2)).toBe("Appariement n°2 (0 paires)");
    expect(exerciseSummaryLabel({ type: "dragdrop", items: [{ id: "i", text: "x", category: "c" }], categories: [] })).toBe("Tri (1 éléments)");
  });
});

describe("describeAnswerRich / correctAnswerOf", () => {
  it("rend null pour une réponse inconnue ou malformée", () => {
    expect(describeAnswerRich(quiz, null)).toBeNull();
    expect(describeAnswerRich(quiz, { optionId: "nope" })).toBeNull();
    expect(describeAnswerRich(wordorder, { words: [] })).toBeNull();
    expect(correctAnswerOf({ type: "matching", pairs: [] })).toBeNull();
  });
});

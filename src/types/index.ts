export type UserRole = "teacher" | "student";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Droits d'administration, cumulables avec le rôle (enseignant admin). */
  isAdmin?: boolean;
  avatar?: string;
  points?: number;
  badges?: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  earnedAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  subject: string;
  ageGroup: string;
  authorId: string;
  exercises: Exercise[];
  publishedAt?: string;
  thumbnail?: string;
}

export interface Exercise {
  id: string;
  type: "quiz" | "matching" | "dragdrop" | "image-quiz";
  title: string;
  data: QuizData | MatchingData | DragDropData;
}

export interface QuizData {
  question: string;
  options: { id: string; text: string; image?: string }[];
  correctId: string;
}

export interface MatchingData {
  pairs: { id: string; left: string; right: string; color: string }[];
}

export interface DragDropData {
  items: { id: string; text: string; category: string }[];
  categories: { id: string; label: string; color: string }[];
}

export interface Progress {
  userId: string;
  lessonId: string;
  exerciseId: string;
  score: number;
  completedAt: string;
  attempts: number;
}

/**
 * Accès client au tableau de bord enseignant via /api/teacher/insights.
 */
import type { TeacherInsights } from "@/lib/teacherInsights";
import { apiFetch } from "@/lib/api/client";

/** Progression des élèves et exercices les plus ratés (leçons de l'enseignant). */
export async function fetchTeacherInsights(): Promise<TeacherInsights> {
  return apiFetch<TeacherInsights>("/api/teacher/insights");
}

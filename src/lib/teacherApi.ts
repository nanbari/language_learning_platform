/**
 * Accès client au tableau de bord enseignant via /api/teacher/insights.
 */
import type { TeacherInsights } from "./teacherInsights";

/** Progression des élèves et exercices les plus ratés (leçons de l'enseignant). */
export async function fetchTeacherInsights(): Promise<TeacherInsights> {
  const res = await fetch("/api/teacher/insights");
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Erreur serveur (${res.status})`);
  return data as TeacherInsights;
}

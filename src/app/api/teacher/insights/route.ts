import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { isStaff } from "@/server/auth";
import { buildTeacherInsights, type InsightLesson } from "@/lib/teacherInsights";
import type { ContentBlock } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "@/lib/exerciseEvents";
import { currentUser } from "@/server/session";
import { serverError } from "@/server/errors";

/** Événements lus pour l'analyse (les plus récents, toutes leçons confondues). */
const EVENTS_LIMIT = 20_000;

/**
 * GET /api/teacher/insights
 * Progression réelle des élèves (par leçon et détaillée par exercice),
 * calculée à partir de `exercise_events`. Enseignants : leurs propres leçons ;
 * admins : toutes. Réponse : TeacherInsights.
 */
export async function GET(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;
  if (!isStaff(session)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const db = supabaseAdmin();

  let lessonsQuery = db.from("lessons").select("id, title, exercises");
  if (!session.isAdmin) lessonsQuery = lessonsQuery.eq("author_id", session.id);
  const { data: lessonRows, error: lessonsError } = await lessonsQuery;
  if (lessonsError) return serverError("/api/teacher/insights lessonsError", lessonsError);

  const lessons: InsightLesson[] = (lessonRows ?? []).map((l) => ({
    id: l.id as string,
    title: l.title as string,
    blocks: ((l.exercises as { blocks?: ContentBlock[] } | null)?.blocks ?? []),
  }));
  if (lessons.length === 0) {
    return NextResponse.json(buildTeacherInsights([], [], []));
  }

  const [{ data: events, error: eventsError }, { data: students, error: usersError }] = await Promise.all([
    db.from("exercise_events")
      .select("*")
      .in("lesson_id", lessons.map((l) => l.id))
      .order("created_at", { ascending: false })
      .limit(EVENTS_LIMIT),
    db.from("users").select("id, name").eq("role", "student"),
  ]);
  if (eventsError) return serverError("/api/teacher/insights eventsError", eventsError);
  if (usersError)  return serverError("/api/teacher/insights usersError", usersError);

  return NextResponse.json(
    buildTeacherInsights(lessons, (students ?? []) as { id: string; name: string }[], (events ?? []) as ExerciseEventRow[]),
  );
}

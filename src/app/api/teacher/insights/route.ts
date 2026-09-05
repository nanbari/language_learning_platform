import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession, isStaff } from "@/lib/auth";
import { buildTeacherInsights, type InsightLesson } from "@/lib/teacherInsights";
import type { ContentBlock } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "@/lib/exerciseEvents";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

/** Événements lus pour l'analyse (les plus récents, toutes leçons confondues). */
const EVENTS_LIMIT = 20_000;

/**
 * GET /api/teacher/insights
 * Progression réelle des élèves et exercices les plus ratés, calculés à
 * partir de `exercise_events`. Enseignants : leurs propres leçons ;
 * admins : toutes. Réponse : TeacherInsights.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const db = supabase();

  let lessonsQuery = db.from("lessons").select("id, title, exercises");
  if (!session.isAdmin) lessonsQuery = lessonsQuery.eq("author_id", session.id);
  const { data: lessonRows, error: lessonsError } = await lessonsQuery;
  if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 });

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
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  if (usersError)  return NextResponse.json({ error: usersError.message }, { status: 500 });

  return NextResponse.json(
    buildTeacherInsights(lessons, (students ?? []) as { id: string; name: string }[], (events ?? []) as ExerciseEventRow[]),
  );
}

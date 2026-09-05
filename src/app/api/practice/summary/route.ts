import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { summariseWeakSpots } from "@/lib/weakSpots";
import type { ContentBlock } from "@/components/lesson/ExerciseRenderers";
import type { ExerciseEventRow } from "@/lib/exerciseEvents";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

/** Événements lus pour l'analyse (les plus récents, toutes leçons confondues). */
const EVENTS_LIMIT = 5000;

/**
 * GET /api/practice/summary?userId=
 * Leçons dans lesquelles l'élève a des exercices à revoir (ratés ou non
 * terminés lors de sa dernière passe), les plus récemment ratées d'abord.
 * Élèves : eux-mêmes uniquement ; enseignants / admins : l'élève indiqué.
 * Réponse : LessonReviewSummary[] (vide si rien à revoir).
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("userId");
  if (session.role === "student" && userId && userId !== session.id) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const effectiveUserId = session.role === "student" ? session.id : userId;
  if (!effectiveUserId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

  const db = supabase();

  const { data: events, error: eventsError } = await db
    .from("exercise_events")
    .select("*")
    .eq("user_id", effectiveUserId)
    .order("created_at", { ascending: false })
    .limit(EVENTS_LIMIT);
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  if (!events || events.length === 0) return NextResponse.json([]);

  // Seules les leçons où l'élève a joué sont chargées.
  const lessonIds = [...new Set(events.map((e) => e.lesson_id))];
  const { data: lessons, error: lessonsError } = await db
    .from("lessons")
    .select("id, exercises")
    .in("id", lessonIds);
  if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 });

  const withBlocks = (lessons ?? []).map((l) => ({
    id: l.id as string,
    blocks: ((l.exercises as { blocks?: ContentBlock[] } | null)?.blocks ?? []),
  }));

  return NextResponse.json(summariseWeakSpots(withBlocks, events as ExerciseEventRow[]));
}

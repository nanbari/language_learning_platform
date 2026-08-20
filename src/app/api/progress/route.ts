import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

// Client service-role : la RLS est contournée, l'autorisation est faite ici
// même (session + rôle) — ne jamais exposer ce client au navigateur.
// Initialisation paresseuse : la clé service-role n'est disponible qu'à
// l'exécution, pas au build (où Next évalue les modules des routes).
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
const supabase = () => (adminClient ??= supabaseAdmin());

async function getSession(req: NextRequest) {
  return verifySession(req.cookies.get(COOKIE_NAME)?.value);
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get("userId");
  const lessonId = searchParams.get("lessonId");

  // Students can only see their own progress. Teachers and admins can read any.
  if (session.role === "student" && userId && userId !== session.id) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const effectiveUserId = session.role === "student" ? session.id : userId;

  let query = supabase().from("progress").select("*");
  if (effectiveUserId) query = query.eq("user_id", effectiveUserId);
  if (lessonId)        query = query.eq("lesson_id", lessonId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "student") {
    return NextResponse.json({ error: "Seuls les élèves enregistrent leur progression" }, { status: 403 });
  }

  const body = await req.json();
  const lessonId = body.lesson_id;
  const rawScore = Number(body.score);
  if (!lessonId || !Number.isFinite(rawScore)) {
    return NextResponse.json({ error: "lesson_id et score requis" }, { status: 400 });
  }
  // Clamp the score to a reasonable range to prevent obvious cheating.
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  // user_id always comes from the session, never the body.
  const userId = session.id;

  const { data: existing } = await supabase()
    .from("progress")
    .select("id, score")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .single();

  if (existing) {
    if (score > existing.score) {
      const { data, error } = await supabase()
        .from("progress")
        .update({ score, completed_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    return NextResponse.json(existing);
  }

  const { data, error } = await supabase()
    .from("progress")
    .insert({ user_id: userId, lesson_id: lessonId, score })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase().rpc("increment_points", { user_id_param: userId, pts: Math.round(score / 10) });

  return NextResponse.json(data, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { parseExerciseEvent, MAX_BATCH, type ExerciseEventInput } from "@/lib/exerciseEvents";
import { currentUser } from "@/server/session";
import { isMissingColumn, serverError, warnOnce } from "@/server/errors";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

/**
 * GET /api/events?lessonId=&userId=&blockId=&limit=
 * Élèves : uniquement leurs propres événements. Enseignants / admins : tout.
 * Tri antéchronologique.
 */
export async function GET(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;

  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get("userId");
  const lessonId = searchParams.get("lessonId");
  const blockId  = searchParams.get("blockId");
  const limit    = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));

  if (session.role === "student" && userId && userId !== session.id) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const effectiveUserId = session.role === "student" ? session.id : userId;

  let query = supabaseAdmin()
    .from("exercise_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (effectiveUserId) query = query.eq("user_id", effectiveUserId);
  if (lessonId)        query = query.eq("lesson_id", lessonId);
  if (blockId)         query = query.eq("block_id", blockId);

  const { data, error } = await query;
  if (error) return serverError("/api/events error", error);
  return NextResponse.json(data);
}

/**
 * POST /api/events
 * Corps : un événement, ou { events: [...] } (au plus MAX_BATCH).
 * Réservé aux élèves ; user_id vient toujours de la session.
 */
export async function POST(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;
  if (session.role !== "student") {
    return NextResponse.json({ error: "Seuls les élèves enregistrent des événements" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.events) ? body.events : body ? [body] : [];
  if (raw.length === 0) return NextResponse.json({ error: "Aucun événement" }, { status: 400 });
  if (raw.length > MAX_BATCH) return NextResponse.json({ error: `Au plus ${MAX_BATCH} événements par requête` }, { status: 400 });

  const rows: (ExerciseEventInput & { user_id: string })[] = [];
  for (let i = 0; i < raw.length; i++) {
    const parsed = parseExerciseEvent(raw[i]);
    if (!parsed.ok) return NextResponse.json({ error: `événement ${i} : ${parsed.error}` }, { status: 400 });
    rows.push({ ...parsed.value, user_id: session.id });
  }

  // Un lot renvoyé après une coupure (même event_id) n'est pas enregistré deux fois.
  const withIds = rows.every((r) => typeof r.event_id === "string");
  let { error } = withIds
    ? await supabaseAdmin().from("exercise_events").upsert(rows, { onConflict: "event_id", ignoreDuplicates: true })
    : await supabaseAdmin().from("exercise_events").insert(rows);
  if (error && withIds && isMissingColumn(error)) {
    // Migration 2026-10-29 pas encore passée : on enregistre sans identifiant, comme avant.
    warnOnce("colonne exercise_events.event_id absente : enregistrement sans identifiant");
    ({ error } = await supabaseAdmin().from("exercise_events").insert(rows.map(({ event_id: _id, ...r }) => { void _id; return r; })));
  }
  if (error) return serverError("/api/events error", error);
  return NextResponse.json({ inserted: rows.length }, { status: 201 });
}

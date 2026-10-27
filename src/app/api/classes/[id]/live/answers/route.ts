import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/session";
import { serverError } from "@/server/errors";
import { isCorrectChoice, PRESENCE_WINDOW_MS, type LiveAnswer, type LiveHostView, type LiveState, type Participant } from "@/lib/liveSession";
import { pokeLive } from "@/server/livePoke";
import { supabaseAdmin } from "@/server/supabase";
import { liveAccess, roomParam } from "@/server/liveAccess";

const MAX_CHOICE_ID = 80;

/**
 * POST /api/classes/:id/live/answers?room=…  { slideIndex, choiceId }  (élève de la classe)
 * Enregistre un essai. L'élève est celui de la session ; l'exactitude est
 * établie ici, à partir de l'écran que l'enseignant a déposé. Un essai sur
 * un autre écran que l'écran courant est refusé (409).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const access = await liveAccess(auth.user, (await params).id, roomParam(req));
  if ("error" in access) return access.error;
  if (access.role !== "student") return NextResponse.json({ error: "Seuls les élèves répondent" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { slideIndex?: unknown; choiceId?: unknown } | null;
  const slideIndex = body?.slideIndex;
  const choiceId = body?.choiceId;
  if (!Number.isInteger(slideIndex) || typeof choiceId !== "string" || !choiceId || choiceId.length > MAX_CHOICE_ID) {
    return NextResponse.json({ error: "réponse invalide" }, { status: 400 });
  }

  const state = access.cls.live_state as LiveState | null;
  if (!state || state.index !== slideIndex) return NextResponse.json({ error: "cet écran n'est plus affiché" }, { status: 409 });
  const correct = isCorrectChoice(state.slide, choiceId);
  if (correct === null) return NextResponse.json({ error: "réponse invalide" }, { status: 400 });

  const { error } = await supabaseAdmin().from("live_answers").insert({
    class_id: access.cls.id,
    room: access.cls.live_room,
    slide_index: slideIndex,
    student_id: auth.user.id,
    choice_id: choiceId,
    correct,
  });
  if (error) return serverError("/api/classes/:id/live/answers POST", error);
  void pokeLive(access.cls.live_room!, "answers");
  // L'élève apprend seulement si *son* essai est juste — ce qu'il voit déjà à l'écran.
  return NextResponse.json({ correct }, { status: 201 });
}

interface AnswerRow {
  slide_index: number;
  student_id: string;
  choice_id: string;
  correct: boolean;
  student: { name: string } | null;
}

/**
 * GET /api/classes/:id/live/answers?room=…  (enseignant de la classe)
 * Toutes les réponses de la séance, dans l'ordre d'arrivée, et les élèves
 * présents. Les élèves n'y ont jamais accès : les essais des autres ne les
 * regardent pas.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const access = await liveAccess(auth.user, (await params).id, roomParam(req));
  if ("error" in access) return access.error;
  if (access.role !== "teacher") return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const db = supabaseAdmin();
  const since = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
  const [answers, present] = await Promise.all([
    db.from("live_answers")
      .select("slide_index, student_id, choice_id, correct, student:users!live_answers_student_id_fkey(name)")
      .eq("class_id", access.cls.id)
      .eq("room", access.cls.live_room)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    db.from("live_participants")
      .select("student_id, student:users!live_participants_student_id_fkey(name)")
      .eq("class_id", access.cls.id)
      .eq("room", access.cls.live_room)
      .gte("seen_at", since),
  ]);
  if (answers.error) return serverError("/api/classes/:id/live/answers GET", answers.error);
  if (present.error) return serverError("/api/classes/:id/live/answers GET présence", present.error);

  const view: LiveHostView = {
    answers: ((answers.data ?? []) as unknown as AnswerRow[]).map((r): LiveAnswer => ({
      slideIndex: r.slide_index,
      studentId: r.student_id,
      name: r.student?.name ?? "",
      choiceId: r.choice_id,
      correct: r.correct,
    })),
    participants: ((present.data ?? []) as unknown as { student_id: string; student: { name: string } | null }[])
      .map((r): Participant => ({ id: r.student_id, name: r.student?.name ?? "" })),
  };
  return NextResponse.json(view);
}

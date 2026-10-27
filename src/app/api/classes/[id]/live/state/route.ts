import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/session";
import { serverError } from "@/server/errors";
import { isLiveState, MAX_STATE_BYTES, type LiveRoomView, type LiveState } from "@/lib/liveSession";
import { pokeLive } from "@/server/livePoke";
import { supabaseAdmin } from "@/server/supabase";
import { liveAccess, roomParam } from "@/server/liveAccess";

/**
 * PUT /api/classes/:id/live/state?room=…  (enseignant de la classe)
 * Dépose l'écran courant de la séance : c'est ce que les élèves reliront.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const access = await liveAccess(auth.user, (await params).id, roomParam(req));
  if ("error" in access) return access.error;
  if (access.role !== "teacher") return NextResponse.json({ error: "Seul l'enseignant présente" }, { status: 403 });

  const raw = await req.text();
  if (raw.length > MAX_STATE_BYTES) return NextResponse.json({ error: "état trop volumineux" }, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* corps invalide, refusé ci-dessous */ }
  if (!isLiveState(body)) return NextResponse.json({ error: "état invalide" }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from("classes")
    .update({ live_state: body, live_state_at: new Date().toISOString() })
    .eq("id", access.cls.id)
    .eq("live_room", access.cls.live_room);
  if (error) return serverError("/api/classes/:id/live/state PUT", error);
  void pokeLive(access.cls.live_room!, "state");
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/classes/:id/live/state?room=…  (élèves de la classe, enseignant)
 * L'écran courant, ou « terminé » si le salon n'est plus celui de la classe.
 * Chaque relecture d'un élève vaut signe de présence pour l'enseignant.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const room = roomParam(req);
  const access = await liveAccess(auth.user, id, room);
  if ("error" in access) {
    // Un élève de la classe dont le cours vient de se terminer voit « terminé », pas une erreur.
    if (access.error.status === 404 && room) {
      const ended = await endedForMember(auth.user.id, id);
      if (ended) return NextResponse.json({ status: "ended" } satisfies LiveRoomView);
    }
    return access.error;
  }

  if (access.role === "student") {
    const { error } = await supabaseAdmin()
      .from("live_participants")
      .upsert({ class_id: access.cls.id, student_id: auth.user.id, room, seen_at: new Date().toISOString() });
    if (error) console.warn("[live] présence non enregistrée :", error.message);
  }
  const state = (access.cls.live_state ?? null) as LiveState | null;
  return NextResponse.json({ status: "live", state } satisfies LiveRoomView);
}

/** L'élève est membre de la classe, mais le salon demandé n'est plus en cours. */
async function endedForMember(studentId: string, classId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("class_members")
    .select("student_id")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

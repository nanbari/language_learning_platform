import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/session";
import { serverError } from "@/server/errors";
import { pokeLive } from "@/server/livePoke";
import { supabaseAdmin } from "@/server/supabase";
import { ownedClass } from "@/server/classAccess";

/** Efface tout ce que la séance a laissé : écran courant, réponses, présences. */
async function clearSession(classId: string) {
  const db = supabaseAdmin();
  const results = await Promise.all([
    db.from("live_answers").delete().eq("class_id", classId),
    db.from("live_participants").delete().eq("class_id", classId),
  ]);
  return results.find((r) => r.error)?.error ?? null;
}

/**
 * POST /api/classes/:id/live — l'enseignant lance le cours en direct de la
 * classe : un nouveau salon, tiré au hasard, que seuls ses élèves recevront.
 * Réponse : { room }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const owned = await ownedClass(auth.user, (await params).id);
  if ("error" in owned) return owned.error;

  const room = crypto.randomUUID();
  const cleared = await clearSession(owned.id);
  if (cleared) return serverError("/api/classes/:id/live POST clear", cleared);
  const { error } = await supabaseAdmin()
    .from("classes")
    .update({ live_room: room, live_started_at: new Date().toISOString(), live_state: null, live_state_at: null })
    .eq("id", owned.id);
  if (error) return serverError("/api/classes/:id/live POST", error);
  return NextResponse.json({ room });
}

/**
 * DELETE /api/classes/:id/live?room=… — fin du cours. Le salon est vérifié :
 * un ancien onglet ne termine pas le cours relancé depuis un autre. Les
 * réponses et présences de la séance sont effacées avec elle.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const owned = await ownedClass(auth.user, (await params).id);
  if ("error" in owned) return owned.error;

  const room = req.nextUrl.searchParams.get("room");
  if (!room) return NextResponse.json({ error: "salon manquant" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("classes")
    .update({ live_room: null, live_started_at: null, live_state: null, live_state_at: null })
    .eq("id", owned.id)
    .eq("live_room", room)
    .select("id");
  if (error) return serverError("/api/classes/:id/live DELETE", error);
  if ((data ?? []).length > 0) {
    const cleared = await clearSession(owned.id);
    if (cleared) return serverError("/api/classes/:id/live DELETE clear", cleared);
    void pokeLive(room, "end");
  }
  return NextResponse.json({ ok: true });
}

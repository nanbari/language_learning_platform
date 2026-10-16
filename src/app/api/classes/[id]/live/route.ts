import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { ownedClass, supabase } from "../../access";

/**
 * POST /api/classes/:id/live — l'enseignant lance le cours en direct de la
 * classe : un nouveau salon, tiré au hasard, que seuls ses élèves recevront.
 * Réponse : { room }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const owned = await ownedClass(session, (await params).id);
  if ("error" in owned) return owned.error;

  const room = crypto.randomUUID();
  const { error } = await supabase()
    .from("classes")
    .update({ live_room: room, live_started_at: new Date().toISOString() })
    .eq("id", owned.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room });
}

/**
 * DELETE /api/classes/:id/live?room=… — fin du cours. Le salon est vérifié :
 * un ancien onglet ne termine pas le cours relancé depuis un autre.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const owned = await ownedClass(session, (await params).id);
  if ("error" in owned) return owned.error;

  const room = req.nextUrl.searchParams.get("room");
  if (!room) return NextResponse.json({ error: "salon manquant" }, { status: 400 });

  const { error } = await supabase()
    .from("classes")
    .update({ live_room: null, live_started_at: null })
    .eq("id", owned.id)
    .eq("live_room", room);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

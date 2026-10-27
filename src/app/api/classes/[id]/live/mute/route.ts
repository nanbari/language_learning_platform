import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/session";
import { pokeLive } from "@/server/livePoke";
import { liveAccess, roomParam } from "@/server/liveAccess";

/**
 * POST /api/classes/:id/live/mute?room=…  (enseignant de la classe)
 * Coupe le micro de tous les élèves : l'ordre part du serveur, sur le canal
 * de contrôle où personne d'autre ne publie — un élève ne peut pas l'imiter.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const access = await liveAccess(auth.user, (await params).id, roomParam(req));
  if ("error" in access) return access.error;
  if (access.role !== "teacher") return NextResponse.json({ error: "Seul l'enseignant coupe les micros" }, { status: 403 });

  await pokeLive(access.cls.live_room!, "muteAll");
  return NextResponse.json({ ok: true });
}

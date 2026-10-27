import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/session";
import { liveTopics } from "@/lib/liveSession";
import { issueLiveToken } from "@/server/liveToken";
import { liveAccess, roomParam } from "@/server/liveAccess";

/**
 * GET /api/classes/:id/live/token?room=…  (enseignant de la classe, élèves)
 * Jeton Realtime de la séance, pour les canaux privés (signal de nouveauté,
 * appel vidéo). Réponse : { token, expiresAt, topics, teacherId, role }.
 * 503 si aucun jeton ne peut être émis (voir server/liveToken) : pas de vidéo, le reste continue.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const access = await liveAccess(auth.user, (await params).id, roomParam(req));
  if ("error" in access) return access.error;

  const room = access.cls.live_room!;
  const issued = await issueLiveToken({ id: auth.user.id, email: auth.user.email }, room, access.role);
  if (!issued) {
    return NextResponse.json({ error: "La vidéo du cours n'est pas disponible pour le moment" }, { status: 503 });
  }
  return NextResponse.json({
    token: issued.token,
    expiresAt: issued.expiresAt,
    topics: liveTopics(room),
    teacherId: access.cls.teacher_id,
    role: access.role,
  }, { headers: { "Cache-Control": "no-store" } });
}

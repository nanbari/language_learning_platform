import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession, isStaff } from "@/lib/auth";
import { requestRecap } from "@/lib/recapVideo";

/**
 * Depuis l'éditeur de leçon : fabrique la vidéo d'introduction de la leçon,
 * puis son diaporama de cours en direct. Répond dès que le rendu est lancé
 * (il prend quelques minutes) ; `started: false` si la leçon est déjà à jour.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { lessonId?: unknown } | null;
  if (typeof body?.lessonId !== "string") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  try {
    const started = await requestRecap({ lessonId: body.lessonId });
    return NextResponse.json({ started }, { status: started ? 202 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

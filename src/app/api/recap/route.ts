import { NextRequest, NextResponse, after } from "next/server";
import { COOKIE_NAME, verifySession, isStaff } from "@/lib/auth";
import { requestRecap, type RecapRequest } from "@/lib/recapVideo";

// Le rendu d'une vidéo prend une à deux minutes : il se poursuit après la réponse.
export const maxDuration = 600;

/**
 * Lancement d'un cours en direct : fabrique la vidéo récapitulative d'une
 * partie (lettres ou vocabulaire) et la place en tête de sa leçon. Répond
 * aussitôt ; le rendu se fait en arrière-plan.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Partial<RecapRequest> | null;
  let request: RecapRequest;
  if (body?.kind === "vocab" && typeof body.lessonId === "string") {
    request = { kind: "vocab", lessonId: body.lessonId };
  } else if (
    body?.kind === "letters" &&
    Array.isArray(body.letterIds) && body.letterIds.length > 0 && body.letterIds.every((id) => Number.isInteger(id))
  ) {
    request = { kind: "letters", letterIds: body.letterIds };
  } else {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  after(() => requestRecap(request, session.id).catch((e) => console.error("[recap]", e)));
  return NextResponse.json({ ok: true }, { status: 202 });
}

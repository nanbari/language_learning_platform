import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession, isStaff } from "@/lib/auth";
import { saveLessonDeck } from "@/lib/lessonDeck";

/**
 * Depuis l'éditeur de leçon : construit et enregistre le diaporama du cours
 * en direct de la leçon. `changed: false` si la leçon avait déjà ce diaporama.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { lessonId?: unknown } | null;
  if (typeof body?.lessonId !== "string") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  try {
    return NextResponse.json(await saveLessonDeck(body.lessonId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

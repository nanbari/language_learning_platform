import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/server/auth";
import { saveLessonDeck } from "@/server/lessonDeck";
import { currentUser } from "@/server/session";

/**
 * Depuis l'éditeur de leçon : construit et enregistre le diaporama du cours
 * en direct de la leçon. `changed: false` si la leçon avait déjà ce diaporama.
 */
export async function POST(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const session = auth.user;
  if (!isStaff(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { lessonId?: unknown } | null;
  if (typeof body?.lessonId !== "string") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  try {
    return NextResponse.json(await saveLessonDeck(body.lessonId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

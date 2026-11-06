import { NextRequest, NextResponse } from "next/server";
import { DeckError, saveLessonDeck } from "@/server/lessonDeck";
import { requireAdmin } from "@/server/session";
import { serverError } from "@/server/errors";
import { isUuid } from "@/lib/classes";

/**
 * Depuis l'éditeur de leçon : construit et enregistre le diaporama du cours
 * en direct de la leçon. `changed: false` si la leçon avait déjà ce diaporama.
 * Réservé aux administrateurs, comme toute écriture de leçon.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as { lessonId?: unknown } | null;
  if (typeof body?.lessonId !== "string" || !isUuid(body.lessonId)) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }

  try {
    return NextResponse.json(await saveLessonDeck(body.lessonId));
  } catch (e) {
    if (e instanceof DeckError) {
      return NextResponse.json({ error: e.message }, { status: e.message === "Leçon introuvable" ? 404 : 422 });
    }
    return serverError("/api/live-deck", e);
  }
}

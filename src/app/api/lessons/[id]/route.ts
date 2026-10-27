import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { isStaff } from "@/server/auth";
import { isUuid } from "@/lib/uuid";
import { currentUser } from "@/server/session";
import { serverError } from "@/server/errors";
import { studentCanSeeLesson } from "@/server/classAccess";
import { withLiveStale } from "@/server/lessonLiveStale";

/**
 * GET /api/lessons/:id — une leçon, avec `live_stale`.
 * Élève : seulement si elle est proposée à l'une de ses classes (sinon 404,
 * comme une leçon inexistante). Enseignants et admins : n'importe laquelle,
 * comme la liste.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const notFound = () => NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  if (!isUuid(id)) return notFound();

  if (!isStaff(auth.user)) {
    const visible = await studentCanSeeLesson(auth.user.id, id).catch(() => null);
    if (visible === null) return serverError("/api/lessons/:id visibilité", new Error("lecture des classes impossible"));
    if (!visible) return notFound();
  }

  const { data, error } = await supabaseAdmin().from("lessons").select("*").eq("id", id).maybeSingle();
  if (error) return serverError("/api/lessons/:id error", error);
  if (!data) return notFound();
  const [row] = await withLiveStale([data as { id: string; title: string; exercises: unknown }]);
  return NextResponse.json(row);
}

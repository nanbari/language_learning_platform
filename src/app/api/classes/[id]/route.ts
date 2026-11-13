import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/session";
import { parseClassUpdate, scheduleColumns } from "@/lib/classes";
import { supabaseAdmin } from "@/server/supabase";
import { ownedClass } from "@/server/classAccess";
import { serverError } from "@/server/errors";

/** PATCH /api/classes/:id — { name?, studentIds?, schedule? } : renomme la classe, remplace ses élèves et/ou fixe son horaire (null le retire). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const owned = await ownedClass(auth.user, (await params).id);
  if ("error" in owned) return owned.error;

  const parsed = parseClassUpdate(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, studentIds, schedule } = parsed.value;
  const db = supabaseAdmin();

  if (name !== undefined || schedule !== undefined) {
    const { error } = await db.from("classes")
      .update({ ...(name !== undefined ? { name } : {}), ...(schedule !== undefined ? scheduleColumns(schedule) : {}) })
      .eq("id", owned.id);
    if (error) return serverError("/api/classes/[id] error", error);
  }

  if (studentIds !== undefined) {
    // Seuls de vrais comptes élèves peuvent entrer dans une classe.
    if (studentIds.length > 0) {
      const { data, error } = await db.from("users").select("id").eq("role", "student").in("id", studentIds);
      if (error) return serverError("/api/classes/[id] error", error);
      if ((data ?? []).length !== studentIds.length) return NextResponse.json({ error: "Élève inconnu" }, { status: 400 });
    }

    const { error: deleteError } = await db.from("class_members").delete().eq("class_id", owned.id);
    if (deleteError) return serverError("/api/classes/[id] deleteError", deleteError);
    if (studentIds.length > 0) {
      const { error } = await db
        .from("class_members")
        .insert(studentIds.map((student_id) => ({ class_id: owned.id, student_id })));
      if (error) return serverError("/api/classes/[id] error", error);
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/classes/:id — supprime la classe (ses élèves gardent leur compte). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  const owned = await ownedClass(auth.user, (await params).id);
  if ("error" in owned) return owned.error;

  const { error } = await supabaseAdmin().from("classes").delete().eq("id", owned.id);
  if (error) return serverError("/api/classes/[id] error", error);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { parseClassUpdate } from "@/lib/classes";
import { ownedClass, supabase } from "../access";

/** PATCH /api/classes/:id — { name?, studentIds? } : renomme la classe et/ou remplace ses élèves. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const owned = await ownedClass(session, (await params).id);
  if ("error" in owned) return owned.error;

  const parsed = parseClassUpdate(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, studentIds } = parsed.value;
  const db = supabase();

  if (name !== undefined) {
    const { error } = await db.from("classes").update({ name }).eq("id", owned.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (studentIds !== undefined) {
    // Seuls de vrais comptes élèves peuvent entrer dans une classe.
    if (studentIds.length > 0) {
      const { data, error } = await db.from("users").select("id").eq("role", "student").in("id", studentIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if ((data ?? []).length !== studentIds.length) return NextResponse.json({ error: "Élève inconnu" }, { status: 400 });
    }

    const { error: deleteError } = await db.from("class_members").delete().eq("class_id", owned.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    if (studentIds.length > 0) {
      const { error } = await db
        .from("class_members")
        .insert(studentIds.map((student_id) => ({ class_id: owned.id, student_id })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/classes/:id — supprime la classe (ses élèves gardent leur compte). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const owned = await ownedClass(session, (await params).id);
  if ("error" in owned) return owned.error;

  const { error } = await supabase().from("classes").delete().eq("id", owned.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

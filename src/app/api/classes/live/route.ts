import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { isLive, type LiveClass } from "@/lib/classes";
import { currentUser } from "@/server/session";
import { serverError } from "@/server/errors";

/**
 * GET /api/classes/live — élève : les cours en direct de ses classes, avec
 * leur salon. Réponse : LiveClass[]. (Même contenu que GET /api/classes pour
 * un élève, mais sous sa propre adresse : /api/classes garde une forme par
 * rôle pour les anciens clients.)
 */
export async function GET(req: NextRequest) {
  const auth = await currentUser(req);
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "student") return NextResponse.json({ error: "Réservé aux élèves" }, { status: 403 });

  const { data, error } = await supabaseAdmin()
    .from("class_members")
    .select("class:classes(id, name, live_room, live_started_at, teacher:users!classes_teacher_id_fkey(name))")
    .eq("student_id", auth.user.id);
  if (error) return serverError("/api/classes/live error", error);

  const now = Date.now();
  const live: LiveClass[] = [];
  type Row = { class: { id: string; name: string; live_room: string | null; live_started_at: string | null; teacher: { name: string } | null } | null };
  for (const row of (data ?? []) as unknown as Row[]) {
    const c = row.class;
    if (c && c.live_room && isLive(c.live_room, c.live_started_at, now)) {
      live.push({ id: c.id, name: c.name, teacherName: c.teacher?.name ?? "", room: c.live_room });
    }
  }
  return NextResponse.json(live);
}

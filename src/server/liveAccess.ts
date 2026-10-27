import { NextResponse } from "next/server";
import type { SessionUser } from "@/server/auth";
import { isLive, isUuid } from "@/lib/classes";
import { serverError } from "@/server/errors";
import { supabaseAdmin } from "@/server/supabase";

/**
 * Qui peut agir sur la séance en direct d'une classe : son enseignant (ou
 * un admin) comme « teacher », ses élèves comme « student ». Vérifié à chaque
 * requête, en base — un élève retiré de la classe est refusé à la requête
 * suivante. Le salon demandé doit être celui du cours en cours : un ancien
 * salon, ou un salon deviné, ne donne rien.
 */
export interface LiveClassRow {
  id: string;
  teacher_id: string;
  live_room: string | null;
  live_started_at: string | null;
  live_state: unknown;
}

export type LiveAccess =
  | { role: "teacher" | "student"; cls: LiveClassRow }
  | { error: NextResponse };

const notFound = () => ({ error: NextResponse.json({ error: "Cours introuvable" }, { status: 404 }) });

export async function liveAccess(user: SessionUser, classId: string, room: string | null): Promise<LiveAccess> {
  if (!isUuid(classId) || !room || !isUuid(room)) return notFound();

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("classes")
    .select("id, teacher_id, live_room, live_started_at, live_state")
    .eq("id", classId)
    .maybeSingle();
  if (error) return { error: serverError("live access: lecture de la classe", error) };
  const cls = data as LiveClassRow | null;
  if (!cls) return notFound();

  if (cls.teacher_id === user.id || user.isAdmin) {
    if (cls.live_room !== room) return notFound();
    return { role: "teacher", cls };
  }
  // Un enseignant sans lien avec la classe n'apprend pas qu'elle existe (comme ownedClass).
  if (user.role !== "student") return notFound();

  const { data: member, error: memberError } = await db
    .from("class_members")
    .select("student_id")
    .eq("class_id", classId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (memberError) return { error: serverError("live access: lecture des membres", memberError) };
  if (!member) return notFound();
  if (cls.live_room !== room || !isLive(cls.live_room, cls.live_started_at)) return notFound();
  return { role: "student", cls };
}

export function roomParam(req: Request): string | null {
  return new URL(req.url).searchParams.get("room");
}

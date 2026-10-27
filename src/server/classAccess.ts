import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabase";
import { isStaff, type SessionUser } from "@/server/auth";
import { isUuid } from "@/lib/classes";
import { serverError } from "@/server/errors";

/**
 * La classe `id`, si l'enseignant connecté peut la gérer (la sienne, ou
 * n'importe laquelle pour un admin) ; sinon la réponse d'erreur à renvoyer.
 */
export async function ownedClass(session: SessionUser | null, id: string): Promise<{ error: NextResponse } | { id: string }> {
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isStaff(session)) return { error: NextResponse.json({ error: "Interdit" }, { status: 403 }) };
  if (!isUuid(id)) return { error: NextResponse.json({ error: "Classe introuvable" }, { status: 404 }) };

  const { data, error } = await supabaseAdmin().from("classes").select("id, teacher_id").eq("id", id).maybeSingle();
  if (error) return { error: serverError("classes access: lecture de la classe", error) };
  if (!data || (data.teacher_id !== session.id && !session.isAdmin)) {
    return { error: NextResponse.json({ error: "Classe introuvable" }, { status: 404 }) };
  }
  return { id: data.id as string };
}

/** Les classes dont l'élève fait partie (ses leçons sont celles de ces classes). */
export async function studentClassIds(studentId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("class_members").select("class_id").eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => m.class_id as string);
}

/** L'élève peut-il ouvrir cette leçon ? (elle est proposée à l'une de ses classes) */
export async function studentCanSeeLesson(studentId: string, lessonId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("lessons").select("class_id").eq("id", lessonId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.class_id) return false;
  return (await studentClassIds(studentId)).includes(data.class_id as string);
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isStaff, type SessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/classes";

// Client service-role : la RLS est contournée, l'autorisation est faite dans
// chaque route (session + rôle + propriété) — ne jamais l'exposer au navigateur.
let adminClient: ReturnType<typeof supabaseAdmin> | null = null;
export const supabase = () => (adminClient ??= supabaseAdmin());

/**
 * La classe `id`, si l'enseignant connecté peut la gérer (la sienne, ou
 * n'importe laquelle pour un admin) ; sinon la réponse d'erreur à renvoyer.
 */
export async function ownedClass(session: SessionUser | null, id: string) {
  if (!session) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isStaff(session)) return { error: NextResponse.json({ error: "Interdit" }, { status: 403 }) };
  if (!isUuid(id)) return { error: NextResponse.json({ error: "Classe introuvable" }, { status: 404 }) };

  const { data, error } = await supabase().from("classes").select("id, teacher_id").eq("id", id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!data || (data.teacher_id !== session.id && !session.isAdmin)) {
    return { error: NextResponse.json({ error: "Classe introuvable" }, { status: 404 }) };
  }
  return { id: data.id as string };
}

/** Les classes dont l'élève fait partie (ses leçons sont celles de ces classes). */
export async function studentClassIds(studentId: string): Promise<string[]> {
  const { data, error } = await supabase().from("class_members").select("class_id").eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => m.class_id as string);
}

/** L'élève peut-il ouvrir cette leçon ? (elle est proposée à l'une de ses classes) */
export async function studentCanSeeLesson(studentId: string, lessonId: string): Promise<boolean> {
  const { data, error } = await supabase().from("lessons").select("class_id").eq("id", lessonId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.class_id) return false;
  return (await studentClassIds(studentId)).includes(data.class_id as string);
}
